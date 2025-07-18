import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/utils/database';
import { logger } from '@/utils/logger';
import { randomUUID } from 'crypto';
import { CryptoHash } from '@/utils/crypto-hash';

// Try to import bcrypt, but don't fail if it's not available
let bcrypt: any;
try {
  bcrypt = require('bcrypt');
} catch (error) {
  logger.warn('bcrypt not available, using built-in crypto module');
}

const router = Router();

// Registration schema
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional()
});

/**
 * Register a new user with email/password
 * Following BigMemory pattern - creates user with email/password
 * Returns the user's UUID token for authentication
 */
router.post('/register-email', async (req, res) => {
  try {
    // Validate input
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validationResult.error.issues
      });
    }

    const { email, password, name } = validationResult.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Email already registered',
        code: 'EMAIL_EXISTS'
      });
    }

    // Hash password using crypto (no native dependencies)
    const passwordHash = await CryptoHash.hash(password);

    // Create user with UUID token
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        token: randomUUID(), // This is the UUID token for authentication
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
        token: true, // Return the UUID token
        createdAt: true
      }
    });

    logger.info('New user registered', { 
      userId: user.id, 
      email: user.email,
      method: 'email/password'
    });

    // Return user data with token
    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        token: user.token, // This is the UUID token to use for authentication
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    logger.error('Registration error', { 
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
    });
  }
});

/**
 * Login with email/password
 * Returns the user's UUID token
 */
router.post('/login-email', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        token: true,
        isActive: true
      }
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        error: 'Account is disabled',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Verify password - try crypto first, then bcrypt if available
    let isValidPassword = false;
    
    try {
      // Check if it's a bcrypt hash
      if (CryptoHash.isBcryptHash(user.passwordHash)) {
        // It's a bcrypt hash, try bcrypt if available
        if (bcrypt) {
          isValidPassword = await bcrypt.compare(password, user.passwordHash);
        } else {
          // bcrypt not available, can't verify old passwords
          logger.error('Cannot verify bcrypt password - bcrypt module not available');
          return res.status(500).json({
            error: 'Password verification unavailable',
            code: 'BCRYPT_NOT_AVAILABLE'
          });
        }
      } else {
        // It's a crypto hash, use our crypto module
        isValidPassword = await CryptoHash.compare(password, user.passwordHash);
      }
    } catch (error) {
      logger.error('Password verification error', { error });
      return res.status(500).json({
        error: 'Password verification failed',
        code: 'VERIFICATION_ERROR'
      });
    }
    
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    logger.info('User logged in', { userId: user.id, email: user.email });

    // Return user data with token
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        token: user.token // UUID token for authentication
      }
    });

  } catch (error) {
    logger.error('Login error', { 
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
    });
  }
});

/**
 * Get current user info by token
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
        code: 'NO_TOKEN'
      });
    }

    // Find user by token
    const user = await prisma.user.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        name: true,
        token: true,
        createdAt: true,
        updatedAt: true,
        emailVerified: true,
        metadata: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    res.json({ user });

  } catch (error) {
    logger.error('Get user error', { error });
    res.status(500).json({
      error: 'Failed to get user info',
      code: 'USER_INFO_ERROR'
    });
  }
});

export default router;