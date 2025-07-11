import { Router, Request, Response } from 'express';
import { prisma } from '@/utils/database';
import { ModuleRegistry } from '@/core/modules/registry.service';
import { getCMIService } from '@/core/cmi/index.service';
import { getEmbeddingService } from '@/core/embeddings/generator.service';
import { Logger } from '@/utils/logger';

const router = Router();
const logger = Logger.getInstance();

// GET /api/health - Basic health check
router.get('/', async (req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'federated-memory',
  });
});

// GET /api/health/detailed - Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  const health: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'federated-memory',
    checks: {},
  };

  try {
    // Check database connection
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = {
      status: 'ok',
      responseTime: Date.now() - dbStart,
    };
  } catch (error) {
    health.status = 'degraded';
    health.checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  try {
    // Check module registry
    const registry = ModuleRegistry.getInstance();
    const modules = await registry.listModules();
    health.checks.moduleRegistry = {
      status: 'ok',
      moduleCount: modules.length,
      modules: modules.map((m: any) => m.id),
    };
  } catch (error) {
    health.status = 'degraded';
    health.checks.moduleRegistry = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  try {
    // Check CMI service
    const cmiService = getCMIService();
    health.checks.cmiService = {
      status: cmiService ? 'ok' : 'not_initialized',
    };
  } catch (error) {
    health.status = 'degraded';
    health.checks.cmiService = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  try {
    // Check embedding service
    const embeddingService = getEmbeddingService();
    health.checks.embeddingService = {
      status: embeddingService ? 'ok' : 'not_initialized',
      provider: 'openai',
    };
  } catch (error) {
    health.status = 'degraded';
    health.checks.embeddingService = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check environment variables
  health.checks.environment = {
    status: 'ok',
    variables: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      JWT_SECRET: !!process.env.JWT_SECRET,
      REDIS_URL: !!process.env.REDIS_URL,
    },
  };

  if (!process.env.DATABASE_URL || !process.env.OPENAI_API_KEY) {
    health.status = 'degraded';
    health.checks.environment.status = 'missing_required';
  }

  return res.status(health.status === 'ok' ? 200 : 503).json(health);
});

// GET /api/health/ready - Readiness check
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if all core services are ready
    await prisma.$queryRaw`SELECT 1`;
    const registry = ModuleRegistry.getInstance();
    const modules = await registry.listModules();

    if (modules.length === 0) {
      throw new Error('No modules loaded');
    }

    return res.json({
      ready: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Readiness check failed', { error });
    return res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/health/live - Liveness check
router.get('/live', async (req: Request, res: Response) => {
  return res.json({
    alive: true,
    timestamp: new Date().toISOString(),
  });
});

export default router;
