import { Router, Request, Response } from 'express';
import { ModuleRegistry } from '@/core/modules/registry.service';
import { AuthRequest } from '@/api/middleware/auth';
import { Logger } from '@/utils/logger';
import { z } from 'zod';

const router = Router();
const logger = Logger.getInstance();

// Validation schemas
const analyzeModuleSchema = z.object({
  options: z.record(z.any()).optional(),
});

// GET /api/modules - List all available modules
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const registry = ModuleRegistry.getInstance();
    const modules = await registry.listModules();

    return res.json({
      modules: modules.map((module: any) => ({
        id: module.id,
        name: module.name,
        description: module.description,
        type: module.type,
      })),
    });
  } catch (error) {
    logger.error('Failed to list modules', { error });
    return res.status(500).json({
      error: 'Failed to list modules',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/modules/:moduleId/stats - Get module statistics
router.get('/:moduleId/stats', async (req: AuthRequest, res: Response) => {
  try {
    const { moduleId } = req.params;
    const registry = ModuleRegistry.getInstance();

    const module = await registry.getModule(moduleId);
    if (!module) {
      return res.status(404).json({
        error: 'Module not found',
      });
    }

    const stats = await module.getStats(req.user!.id);

    return res.json({
      moduleId,
      stats,
    });
  } catch (error) {
    logger.error('Failed to get module stats', { error });
    return res.status(500).json({
      error: 'Failed to get module statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/modules/:moduleId/analyze - Analyze module-specific data
router.post('/:moduleId/analyze', async (req: AuthRequest, res: Response) => {
  try {
    const { moduleId } = req.params;
    const validation = analyzeModuleSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const { options } = validation.data;
    const registry = ModuleRegistry.getInstance();

    const module = await registry.getModule(moduleId);
    if (!module) {
      return res.status(404).json({
        error: 'Module not found',
      });
    }

    // Check if module has analyze method
    if (!('analyze' in module) || typeof (module as any).analyze !== 'function') {
      return res.status(400).json({
        error: 'Module does not support analysis',
      });
    }

    const analysis = await (module as any).analyze(req.user!.id, options);

    logger.info('Module analysis via REST API', {
      userId: req.user!.id,
      moduleId,
    });

    return res.json({
      moduleId,
      analysis,
    });
  } catch (error) {
    logger.error('Failed to analyze module data', { error });
    return res.status(500).json({
      error: 'Failed to analyze module data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/modules/:moduleId/memories - Get memories from a specific module
router.get('/:moduleId/memories', async (req: AuthRequest, res: Response) => {
  try {
    const { moduleId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const registry = ModuleRegistry.getInstance();
    const module = await registry.getModule(moduleId);

    if (!module) {
      return res.status(404).json({
        error: 'Module not found',
      });
    }

    // This would need to be implemented in BaseModule
    // For now, we'll use search with empty query
    const results = await module.search(req.user!.id, '', {
      limit: Number(limit),
      minScore: 0, // Return all
    });

    return res.json({
      moduleId,
      memories: results,
      count: results.length,
    });
  } catch (error) {
    logger.error('Failed to get module memories', { error });
    return res.status(500).json({
      error: 'Failed to get module memories',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
