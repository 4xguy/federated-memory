import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/utils/database';
import { logger } from '@/utils/logger';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { authCorsMiddleware } from '@/api/middleware/cors';

const router = Router();

// Apply CORS middleware to all auth routes
router.use(authCorsMiddleware);

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

/**
 * POST /api/auth/login - Login with email and password (BigMemory pattern)
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    logger.info('Login attempt', { email: req.body.email });
    
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      logger.warn('Login validation failed', { errors: validationResult.error.issues });
      return res.status(400).json({
        error: 'Invalid input',
        details: validationResult.error.issues
      });
    }

    const { email, password } = validationResult.data;

    // Test database connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info('Database connection test successful');
    } catch (dbError) {
      logger.error('Database connection failed', { error: dbError });
      return res.status(500).json({
        error: 'Database connection failed',
        code: 'DATABASE_ERROR'
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        token: true,
        isActive: true,
        metadata: true
      }
    });

    if (!user || !user.passwordHash) {
      logger.warn('Login failed - user not found or no password hash', { email });
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (!user.isActive) {
      logger.warn('Login failed - account disabled', { email });
      return res.status(403).json({
        error: 'Account is disabled',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Verify password
    let isValidPassword = false;
    
    try {
      // Try bcrypt first (new standard)
      isValidPassword = await bcrypt.compare(password, user.passwordHash);
    } catch (error) {
      // If bcrypt fails, try SHA256 for legacy users
      const crypto = require('crypto');
      const testHash = crypto.createHash('sha256').update(password).digest('hex');
      isValidPassword = testHash === user.passwordHash;
      
      if (isValidPassword) {
        // Migrate to bcrypt on successful login
        const newHash = await bcrypt.hash(password, 10);
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newHash }
        });
        logger.info('Migrated user password to bcrypt', { userId: user.id });
      }
    }
    
    if (!isValidPassword) {
      logger.warn('Login failed - invalid password', { email });
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    logger.info('User logged in successfully', { userId: user.id, email: user.email });

    res.json({
      success: true,
      userId: user.id,
      token: user.token,
      message: 'Login successful',
    });

  } catch (error) {
    logger.error('Login error', { 
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

/**
 * POST /api/auth/register-email - Register with email and password (BigMemory pattern)
 */
router.post('/register-email', async (req: Request, res: Response) => {
  try {
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validationResult.error.issues
      });
    }

    const { email, password, name } = validationResult.data;

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Email already registered',
        code: 'EMAIL_EXISTS'
      });
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        token: randomUUID(),
        isActive: true,
        emailVerified: false,
        metadata: {
          registrationMethod: 'email',
          registeredAt: new Date().toISOString()
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        token: true,
        createdAt: true
      }
    });

    logger.info('New user registered', { 
      userId: user.id, 
      email: user.email,
      method: 'email/password'
    });

    res.status(201).json({
      success: true,
      userId: user.id,
      message: 'Registration successful',
    });

  } catch (error) {
    logger.error('Registration error', { 
      error: error instanceof Error ? error.message : error
    });
    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

/**
 * POST /api/auth/validate - Validate token
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(400).json({
        error: 'Token required',
        code: 'TOKEN_REQUIRED'
      });
    }
    
    const user = await prisma.user.findUnique({
      where: { token },
      select: { id: true }
    });
    
    if (!user) {
      return res.status(401).json({
        valid: false,
        message: 'Invalid token',
      });
    }
    
    res.json({
      valid: true,
      userId: user.id,
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
 * GET /api/auth/me - Get current user information
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    const user = await prisma.user.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!user) {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    res.json(user);
  } catch (error) {
    logger.error('Get user error', { error });
    res.status(500).json({
      error: 'Failed to get user information',
      code: 'GET_USER_ERROR'
    });
  }
});

export default router; 