import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/utils/database';
import { logger } from '@/utils/logger';
import { authMiddleware } from '@/api/middleware/auth';
import { randomBytes } from 'crypto';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation schemas
const createKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  expiresIn: z.number().optional(), // Days until expiration
});

/**
 * GET /api/keys - Get all API keys for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        lastUsed: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ keys });
  } catch (error) {
    logger.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

/**
 * POST /api/keys - Create a new API key
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const validationResult = createKeySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: validationResult.error.issues,
      });
    }

    const { name, expiresIn } = validationResult.data;

    // Generate a secure API key
    const keyBytes = randomBytes(32);
    const apiKey = `sk_${keyBytes.toString('base64url')}`;
    const keyPrefix = apiKey.substring(0, 8);

    // Calculate expiration date if provided
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000)
      : null;

    // Hash the API key for storage
    const bcrypt = require('bcrypt');
    const hashedKey = await bcrypt.hash(apiKey, 10);

    // Create the API key record
    const keyRecord = await prisma.apiKey.create({
      data: {
        userId,
        name,
        keyHash: hashedKey,
        keyPrefix,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    logger.info('API key created', { userId, keyId: keyRecord.id });

    // Return the full key only on creation
    res.status(201).json({
      ...keyRecord,
      key: apiKey,
    });
  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

/**
 * DELETE /api/keys/:id - Delete an API key
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const { id } = req.params;

    // Check if the key belongs to the user
    const key = await prisma.apiKey.findFirst({
      where: { id, userId },
    });

    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Delete the key
    await prisma.apiKey.delete({
      where: { id },
    });

    logger.info('API key deleted', { userId, keyId: id });

    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    logger.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

export default router;