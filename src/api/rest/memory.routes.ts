import { Router, Request, Response } from 'express';
import { getCMIService } from '@/core/cmi/index.service';
import { AuthRequest } from '@/api/middleware/auth';
import { Logger } from '@/utils/logger';
import { z } from 'zod';

const router = Router();
const logger = Logger.getInstance();

// Validation schemas
const storeMemorySchema = z.object({
  content: z.string().min(1).max(50000),
  metadata: z.record(z.any()).optional(),
  moduleId: z.string().optional(),
});

const searchMemorySchema = z.object({
  query: z.string().min(1).max(1000),
  moduleId: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional().default(10),
  minScore: z.number().min(0).max(1).optional().default(0.5),
});

const updateMemorySchema = z.object({
  content: z.string().min(1).max(50000).optional(),
  metadata: z.record(z.any()).optional(),
});

// POST /api/memories - Store a new memory
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const validation = storeMemorySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const { content, metadata, moduleId } = validation.data;
    const cmiService = getCMIService();

    const memoryId = await cmiService.store(req.user!.id, content, metadata, moduleId);

    logger.info('Memory stored via REST API', {
      userId: req.user!.id,
      memoryId,
      moduleId,
    });

    return res.status(201).json({
      id: memoryId,
      message: 'Memory stored successfully',
    });
  } catch (error) {
    logger.error('Failed to store memory', { error });
    return res.status(500).json({
      error: 'Failed to store memory',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/memories/search - Search memories
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const validation = searchMemorySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.errors,
      });
    }

    const { query, moduleId, limit, minScore } = validation.data;
    const cmiService = getCMIService();

    const results = await cmiService.search(req.user!.id, query, {
      moduleId,
      limit,
      minScore,
    });

    logger.info('Memory search via REST API', {
      userId: req.user!.id,
      query,
      resultsCount: results.length,
    });

    return res.json({
      results,
      count: results.length,
    });
  } catch (error) {
    logger.error('Failed to search memories', { error });
    return res.status(500).json({
      error: 'Failed to search memories',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/memories/:id - Get a specific memory
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const cmiService = getCMIService();

    const memory = await cmiService.get(req.user!.id, id);

    if (!memory) {
      return res.status(404).json({
        error: 'Memory not found',
      });
    }

    return res.json(memory);
  } catch (error) {
    logger.error('Failed to get memory', { error });
    return res.status(500).json({
      error: 'Failed to get memory',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PUT /api/memories/:id - Update a memory
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updateMemorySchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const updates = validation.data;
    const cmiService = getCMIService();

    const success = await cmiService.update(req.user!.id, id, updates);

    if (!success) {
      return res.status(404).json({
        error: 'Memory not found or update failed',
      });
    }

    logger.info('Memory updated via REST API', {
      userId: req.user!.id,
      memoryId: id,
    });

    return res.json({
      message: 'Memory updated successfully',
    });
  } catch (error) {
    logger.error('Failed to update memory', { error });
    return res.status(500).json({
      error: 'Failed to update memory',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/memories/:id - Delete a memory
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const cmiService = getCMIService();

    const success = await cmiService.delete(req.user!.id, id);

    if (!success) {
      return res.status(404).json({
        error: 'Memory not found or already deleted',
      });
    }

    logger.info('Memory deleted via REST API', {
      userId: req.user!.id,
      memoryId: id,
    });

    return res.json({
      message: 'Memory deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete memory', { error });
    return res.status(500).json({
      error: 'Failed to delete memory',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
