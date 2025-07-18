import { Router } from 'express';
import { prisma } from '@/utils/database';
import { logger } from '@/utils/logger';
import { randomUUID } from 'crypto';

const router = Router();

/**
 * EMERGENCY LOGIN - NO PASSWORD VERIFICATION
 * This is a temporary endpoint to bypass authentication issues
 */
router.post('/emergency-login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        code: 'MISSING_EMAIL'
      });
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        token: true,
        isActive: true
      }
    });

    if (!user) {
      // Create user without password
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: 'EMERGENCY_USER',
          token: randomUUID(),
          isActive: true,
          emailVerified: false,
          metadata: {
            registrationMethod: 'emergency',
            registeredAt: new Date().toISOString()
          }
        },
        select: {
          id: true,
          email: true,
          name: true,
          token: true
        }
      });
      logger.info('Emergency user created', { userId: user.id, email });
    } else {
      logger.info('Emergency login', { userId: user.id, email });
    }

    // Return user data with token
    res.json({
      message: 'Emergency login successful',
      warning: 'This is a temporary endpoint - do not use in production',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        token: user.token
      }
    });

  } catch (error) {
    logger.error('Emergency login error', { error });
    res.status(500).json({
      error: 'Emergency login failed',
      code: 'EMERGENCY_LOGIN_ERROR'
    });
  }
});

/**
 * Generate token without any authentication
 */
router.get('/emergency-token', async (req, res) => {
  try {
    const token = randomUUID();
    
    // Create anonymous user
    const user = await prisma.user.create({
      data: {
        email: `anon-${Date.now()}@emergency.local`,
        passwordHash: 'EMERGENCY_ANON',
        token,
        isActive: true,
        emailVerified: false,
        metadata: {
          registrationMethod: 'emergency-anonymous',
          registeredAt: new Date().toISOString()
        }
      },
      select: {
        id: true,
        token: true
      }
    });

    logger.info('Emergency anonymous token created', { userId: user.id });

    res.json({
      message: 'Emergency token generated',
      warning: 'This is a temporary endpoint - do not use in production',
      token: user.token,
      mcpUrl: `${process.env.BASE_URL || 'https://federated-memory-production.up.railway.app'}/${user.token}/sse`
    });

  } catch (error) {
    logger.error('Emergency token error', { error });
    res.status(500).json({
      error: 'Emergency token generation failed',
      code: 'EMERGENCY_TOKEN_ERROR'
    });
  }
});

export default router;