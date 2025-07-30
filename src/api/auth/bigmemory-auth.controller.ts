import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { emailAuthService } from '@/services/auth/email-auth.service';
import { authMiddleware } from '@/api/middleware/auth';
import { logger } from '@/utils/logger';
import { authCorsMiddleware } from '@/api/middleware/cors';

const router = Router();

// Apply CORS middleware to all auth routes
router.use(authCorsMiddleware);

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const registerEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const registerCliSchema = z.object({
  metadata: z.record(z.any()).optional(),
});

const verifyEmailSchema = z.object({
  token: z.string(),
});

const rotateTokenSchema = z.object({
  currentToken: z.string().uuid(),
});

const resendVerificationSchema = z.object({
  email: z.string().email(),
});

const reactivateSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/**
 * POST /api/auth/register - Legacy registration (no email required)
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { metadata } = req.body;
    
    const result = await emailAuthService.createUser(metadata);
    
    logger.info('New legacy user registered', { userId: result.userId });
    
    res.status(201).json({
      success: true,
      userId: result.userId,
      token: result.token,
      authUrl: await emailAuthService.createAuthUrl(result.token),
      message: 'User created successfully. Save your token securely.',
    });
  } catch (error) {
    logger.error('Registration error', { error });
    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

/**
 * POST /api/auth/register-email - Register with email verification
 */
router.post('/register-email', async (req: Request, res: Response) => {
  try {
    const validationResult = registerEmailSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validationResult.error.issues
      });
    }

    const { email, password, name, metadata } = validationResult.data;
    
    try {
      const result = await emailAuthService.createUserWithEmail(email, password, metadata);
      
      res.status(201).json({
        success: true,
        userId: result.userId,
        message: 'Registration successful. Please check your email to verify your account.',
      });
    } catch (error: any) {
      if (error.message === 'Email already registered') {
        res.status(409).json({
          error: 'Conflict',
          message: 'Email already registered',
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    logger.error('Email registration error', { error });
    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

/**
 * POST /api/auth/register-cli - CLI registration (no email required)
 */
router.post('/register-cli', async (req: Request, res: Response) => {
  try {
    const validationResult = registerCliSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validationResult.error.issues
      });
    }

    const { metadata } = validationResult.data;
    
    const result = await emailAuthService.createCliUser(metadata);
    
    logger.info('New CLI user registered', { userId: result.userId });
    
    res.status(201).json({
      success: true,
      userId: result.userId,
      token: result.token,
      tier: 'free',
      message: 'CLI user created successfully. Upgrade to a paid plan for more features.',
    });
  } catch (error) {
    logger.error('CLI registration error', { error });
    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

/**
 * POST /api/auth/verify-email - Verify email address
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const validationResult = verifyEmailSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validationResult.error.issues
      });
    }

    const { token } = validationResult.data;
    
    const result = await emailAuthService.verifyEmail(token);
    
    if (!result) {
      res.status(400).json({
        error: 'Bad request',
        message: 'Invalid or expired verification token',
      });
      return;
    }
    
    res.json({
      success: true,
      userId: result.userId,
      token: result.token,
      message: 'Email verified successfully. Check your email for your API token.',
    });
  } catch (error) {
    logger.error('Email verification error', { error });
    res.status(500).json({
      error: 'Verification failed',
      code: 'VERIFICATION_ERROR'
    });
  }
});

/**
 * GET /api/auth/verify-email - Verify email via GET (for email links)
 */
router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    
    if (!token) {
      res.status(400).json({
        error: 'Bad request',
        message: 'Verification token is required',
      });
      return;
    }
    
    const result = await emailAuthService.verifyEmail(token);
    
    if (!result) {
      // Redirect to error page on dashboard
      const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${dashboardUrl}/verify-error?reason=invalid`);
      return;
    }
    
    // Redirect to success page on dashboard
    const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${dashboardUrl}/verify-success?token=${result.token}`);
  } catch (error) {
    logger.error('Email verification error', { error });
    res.status(500).json({
      error: 'Verification failed',
      code: 'VERIFICATION_ERROR'
    });
  }
});

/**
 * POST /api/auth/resend-verification - Resend verification email
 */
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const validationResult = resendVerificationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validationResult.error.issues
      });
    }

    const { email } = validationResult.data;
    
    await emailAuthService.resendVerificationEmail(email);
    
    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If an unverified account exists with this email, a new verification link has been sent.',
    });
  } catch (error) {
    logger.error('Resend verification error', { error });
    res.status(500).json({
      error: 'Operation failed',
      code: 'RESEND_ERROR'
    });
  }
});

/**
 * POST /api/auth/login - Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validationResult.error.issues
      });
    }

    const { email, password } = validationResult.data;
    
    try {
      const result = await emailAuthService.loginWithPassword(email, password);
      
      if (!result) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
        return;
      }
      
      res.json({
        success: true,
        userId: result.userId,
        token: result.token,
        user: result.user,
        message: 'Login successful',
      });
    } catch (error: any) {
      if (error.message === 'Email not verified') {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Please verify your email before logging in',
        });
        return;
      }
      if (error.message === 'Account is deactivated') {
        res.status(403).json({
          error: 'Forbidden',
          message: 'This account has been deactivated',
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    logger.error('Login error', { error });
    res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

/**
 * POST /api/auth/validate - Validate token
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const token = req.body.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Token is required',
      });
    }
    
    // Reuse the auth service's validateToken method
    const authService = require('@/services/auth.service').AuthService.getInstance();
    const result = await authService.validateToken(token);
    
    if (!result) {
      return res.status(401).json({
        valid: false,
        message: 'Invalid token',
      });
    }
    
    res.json({
      valid: true,
      userId: result.userId,
    });
  } catch (error) {
    logger.error('Token validation error', { error });
    res.status(500).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR'
    });
  }
});

/**
 * POST /api/auth/rotate - Rotate authentication token
 */
router.post('/rotate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const validationResult = rotateTokenSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validationResult.error.issues
      });
    }

    const { currentToken } = validationResult.data;
    
    const newToken = await emailAuthService.rotateToken(currentToken);
    
    res.json({
      success: true,
      token: newToken,
      message: 'Token rotated successfully. Update your applications with the new token.',
    });
  } catch (error: any) {
    if (error.message === 'Invalid token') {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token',
      });
      return;
    }
    
    logger.error('Token rotation error', { error });
    res.status(500).json({
      error: 'Rotation failed',
      code: 'ROTATION_ERROR'
    });
  }
});

/**
 * GET /api/auth/me - Get current user info
 */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No user session',
      });
    }
    
    const user = await emailAuthService.getCurrentUser(userId);
    
    if (!user) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }
    
    res.json({
      user,
    });
  } catch (error) {
    logger.error('Get current user error', { error });
    res.status(500).json({
      error: 'Failed to get user info',
      code: 'USER_INFO_ERROR'
    });
  }
});

/**
 * DELETE /api/auth/deactivate - Deactivate account
 */
router.delete('/deactivate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No user session',
      });
    }
    
    await emailAuthService.deactivateAccount(userId);
    
    res.json({
      success: true,
      message: 'Account deactivated successfully',
    });
  } catch (error) {
    logger.error('Deactivation error', { error });
    res.status(500).json({
      error: 'Deactivation failed',
      code: 'DEACTIVATION_ERROR'
    });
  }
});

/**
 * POST /api/auth/reactivate - Reactivate account
 */
router.post('/reactivate', async (req: Request, res: Response) => {
  try {
    const validationResult = reactivateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validationResult.error.issues
      });
    }

    const { email, password } = validationResult.data;
    
    const result = await emailAuthService.reactivateAccount(email, password);
    
    if (!result) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
      return;
    }
    
    res.json({
      success: true,
      userId: result.userId,
      token: result.token,
      user: result.user,
      message: 'Account reactivated successfully',
    });
  } catch (error) {
    logger.error('Reactivation error', { error });
    res.status(500).json({
      error: 'Reactivation failed',
      code: 'REACTIVATION_ERROR'
    });
  }
});

export default router;