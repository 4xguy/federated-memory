import { Router, Request, Response } from 'express';
import { AuthService } from '@/services/auth.service';
import { authMiddleware } from '@/api/middleware/auth';
import { logger } from '@/utils/logger';

const router = Router();
const authService = AuthService.getInstance();

/**
 * POST /api/auth/register
 * Register a new user and get UUID token
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    const result = await authService.registerUser(email);
    
    logger.info('New user registered', { 
      userId: result.userId, 
      hasEmail: !!email 
    });
    
    res.status(201).json({
      success: true,
      data: {
        token: result.token,
        userId: result.userId
      }
    });
  } catch (error: any) {
    logger.error('Registration error', { error });
    
    if (error.message === 'Email already registered') {
      return res.status(409).json({
        error: 'Email already registered',
        code: 'EMAIL_EXISTS'
      });
    }
    
    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

/**
 * POST /api/auth/register-cli
 * CLI-friendly registration (no email required)
 */
router.post('/register-cli', async (_req: Request, res: Response) => {
  try {
    const result = await authService.registerUser();
    
    // Simple response for CLI parsing
    res.json({ token: result.token });
  } catch (error) {
    logger.error('CLI registration error', { error });
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/rotate
 * Rotate user's authentication token
 */
router.post('/rotate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const newToken = await authService.rotateToken(userId);
    
    logger.info('Token rotated', { userId });
    
    res.json({
      success: true,
      data: {
        token: newToken
      }
    });
  } catch (error) {
    logger.error('Token rotation error', { error });
    res.status(500).json({
      error: 'Token rotation failed',
      code: 'ROTATION_ERROR'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await authService.getUserById(req.userId!);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        metadata: user.metadata,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    logger.error('Get user error', { error });
    res.status(500).json({
      error: 'Failed to get user information',
      code: 'GET_USER_ERROR'
    });
  }
});

/**
 * POST /api/auth/validate
 * Validate a token (useful for debugging)
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        error: 'Token required',
        code: 'TOKEN_REQUIRED'
      });
    }
    
    const result = await authService.validateToken(token);
    
    res.json({
      success: true,
      data: {
        valid: !!result,
        userId: result?.userId
      }
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
 * POST /api/auth/migrate
 * Migrate from old authentication system (if needed)
 */
router.post('/migrate', async (req: Request, res: Response) => {
  try {
    const oldApiKey = req.headers['x-old-api-key'] as string;
    const oldToken = req.headers['x-old-token'] as string;
    
    if (!oldApiKey && !oldToken) {
      return res.status(400).json({
        error: 'Old credentials required',
        code: 'OLD_CREDENTIALS_REQUIRED'
      });
    }
    
    // TODO: Implement migration logic based on your needs
    // This is a placeholder for migration from old system
    
    res.status(501).json({
      error: 'Migration not implemented',
      code: 'NOT_IMPLEMENTED'
    });
  } catch (error) {
    logger.error('Migration error', { error });
    res.status(500).json({
      error: 'Migration failed',
      code: 'MIGRATION_ERROR'
    });
  }
});

export default router;