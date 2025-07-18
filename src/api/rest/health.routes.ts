import { Router, Request, Response } from 'express';
import { prisma } from '@/utils/database';
import { ModuleRegistry } from '../../core/modules/registry.service';
import { getCMIService } from '../../core/cmi/index.service';
import { getEmbeddingService } from '@/core/embeddings/generator.service';
import { Logger } from '@/utils/logger';
import { emailService } from '@/services/email/email.service';

const router = Router();
const logger = Logger.getInstance();

// GET /api/health - Basic health check
router.get('/', async (req: Request, res: Response) => {
  try {
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'federated-memory',
    });
  } catch (error) {
    // Even if there's an error, return OK for basic health check
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'federated-memory',
      note: 'Basic health check only',
    });
  }
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
    
    // Also check connection pool status
    const connectionStats = await prisma.$queryRaw<[{ 
      total: bigint, 
      active: bigint, 
      idle: bigint,
      max_connections: string 
    }]>`
      WITH stats AS (
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE state = 'active') as active,
          COUNT(*) FILTER (WHERE state = 'idle') as idle
        FROM pg_stat_activity
        WHERE datname = current_database()
      ),
      max_conn AS (
        SELECT setting as max_connections FROM pg_settings WHERE name = 'max_connections'
      )
      SELECT stats.*, max_conn.max_connections FROM stats, max_conn
    `;
    
    const stats = connectionStats[0];
    const usage = (Number(stats.total) / parseInt(stats.max_connections)) * 100;
    
    health.checks.database = {
      status: usage > 80 ? 'warning' : 'ok',
      responseTime: Date.now() - dbStart,
      connections: {
        total: Number(stats.total),
        active: Number(stats.active),
        idle: Number(stats.idle),
        max: parseInt(stats.max_connections),
        usage: `${usage.toFixed(1)}%`,
      },
    };
    
    if (usage > 80) {
      health.status = 'degraded';
    }
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
    const isMock = process.env.OPENAI_API_KEY === 'sk-test' || !process.env.OPENAI_API_KEY;
    health.checks.embeddingService = {
      status: embeddingService ? 'ok' : 'not_initialized',
      provider: isMock ? 'mock' : 'openai',
      mock: isMock,
    };
  } catch (error) {
    health.status = 'degraded';
    health.checks.embeddingService = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check email service
  try {
    const emailConnected = await emailService.testConnection();
    health.checks.email = {
      status: emailConnected ? 'ok' : 'not_configured',
      provider: process.env.EMAIL_PROVIDER || 'none',
      configured: !!process.env.EMAIL_PROVIDER,
      connected: emailConnected,
    };
  } catch (error) {
    health.checks.email = {
      status: 'error',
      provider: process.env.EMAIL_PROVIDER || 'none',
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
      EMAIL_PROVIDER: !!process.env.EMAIL_PROVIDER,
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
