import { Router, Request, Response } from 'express';
import { prisma } from '@/utils/database';
import { AuthRequest } from '@/api/middleware/auth';
import { Logger } from '@/utils/logger';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const logger = Logger.getInstance();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email()
});

const loginSchema = z.object({
  email: z.string().email()
});

// POST /api/users/register - Register a new user
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: validation.error.errors 
      });
    }

    const { email } = validation.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({ 
        error: 'User already exists' 
      });
    }

    // Create new user first
    const userId = uuidv4();
    const user = await prisma.user.create({
      data: {
        id: userId,
        email,
        token: '' // Will update with JWT token
      }
    });

    // Create JWT token with actual user ID
    const token = jwt.sign(
      { userId: user.id, email },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '30d' }
    );

    // Update user with token
    await prisma.user.update({
      where: { id: user.id },
      data: { token }
    });

    logger.info('User registered via REST API', {
      userId: user.id,
      email: user.email
    });

    return res.status(201).json({
      id: user.id,
      email: user.email,
      token: token
    });
  } catch (error) {
    logger.error('Failed to register user', { error });
    return res.status(500).json({ 
      error: 'Failed to register user',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/users/login - Login user
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: validation.error.errors 
      });
    }

    const { email } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    logger.info('User logged in via REST API', {
      userId: user.id,
      email: user.email
    });

    return res.json({
      id: user.id,
      email: user.email,
      token: user.token
    });
  } catch (error) {
    logger.error('Failed to login user', { error });
    return res.status(500).json({ 
      error: 'Failed to login user',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/users/me - Get current user info
router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    return res.json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    logger.error('Failed to get user info', { error });
    return res.status(500).json({ 
      error: 'Failed to get user info',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/users/stats - Get user statistics across all modules
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get memory counts from each module
    const [
      technicalCount,
      personalCount,
      workCount,
      learningCount,
      communicationCount,
      creativeCount,
      totalIndexed
    ] = await Promise.all([
      prisma.technicalMemory.count({ where: { userId } }),
      prisma.personalMemory.count({ where: { userId } }),
      prisma.workMemory.count({ where: { userId } }),
      prisma.learningMemory.count({ where: { userId } }),
      prisma.communicationMemory.count({ where: { userId } }),
      prisma.creativeMemory.count({ where: { userId } }),
      prisma.memoryIndex.count({ where: { userId } })
    ]);

    const moduleBreakdown = {
      technical: technicalCount,
      personal: personalCount,
      work: workCount,
      learning: learningCount,
      communication: communicationCount,
      creative: creativeCount
    };

    const totalMemories = Object.values(moduleBreakdown).reduce((a, b) => a + b, 0);

    return res.json({
      totalMemories,
      totalIndexed,
      moduleBreakdown,
      averageMemoriesPerModule: totalMemories / Object.keys(moduleBreakdown).length
    });
  } catch (error) {
    logger.error('Failed to get user stats', { error });
    return res.status(500).json({ 
      error: 'Failed to get user statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/users/me - Delete current user and all their data
router.delete('/me', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Delete all memories from all modules (cascade delete should handle this)
    await prisma.user.delete({
      where: { id: userId }
    });

    logger.info('User deleted via REST API', { userId });

    return res.json({
      message: 'User and all associated data deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete user', { error });
    return res.status(500).json({ 
      error: 'Failed to delete user',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;