import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger';
import { ModuleLoader } from './core/modules/loader.service';
import { ModuleRegistry } from './core/modules/registry.service';
import { getCMIService } from './core/cmi/index.service';
import { Redis } from './utils/redis';

// Initialize Prisma
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Initialize services
export const moduleRegistry = ModuleRegistry.getInstance();
export const cmiService = getCMIService();
export const moduleLoader = ModuleLoader.getInstance();

async function main() {
  try {
    // Connect to database
    await prisma.$connect();
    logger.info('Connected to PostgreSQL database');

    // Connect to Redis if configured
    const redis = Redis.getInstance();
    if (redis) {
      await redis.connect();
      logger.info('Connected to Redis');
    }

    // Load active modules
    const moduleResults = await moduleLoader.loadAllModules();
    const successfulModules = moduleResults.filter(r => r.success).length;
    logger.info(`Loaded ${successfulModules} modules successfully`);

    // Initialize Express app
    const app = express();
    const server = createServer(app);

    // Middleware
    app.use(helmet());
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));

    // Health check
    app.get('/health', async (req, res) => {
      const health = await moduleRegistry.getAllModuleHealth();
      res.json({
        status: 'ok',
        modules: health,
        timestamp: new Date().toISOString(),
      });
    });

    // Placeholder for REST API
    app.use('/api', (req, res, next) => {
      // TODO: Implement authentication middleware
      next();
    }, (req, res) => {
      res.json({ message: 'API endpoints not yet implemented' });
    });

    // Error handling
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });

    // Placeholder for WebSocket server for MCP
    const wss = new WebSocketServer({ server, path: '/mcp' });
    wss.on('connection', (ws) => {
      logger.info('New MCP WebSocket connection');
      ws.on('message', (message) => {
        logger.debug('MCP message received:', message.toString());
        // TODO: Implement MCP protocol
        ws.send(JSON.stringify({ error: 'MCP protocol not yet implemented' }));
      });
    });

    // Start server
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
      logger.info(`Federated Memory System running on port ${port}`);
      logger.info(`REST API: http://localhost:${port}/api`);
      logger.info(`MCP WebSocket: ws://localhost:${port}/mcp`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('HTTP server closed');
      });
      
      await moduleLoader.cleanup();
      await cmiService.cleanup();
      await prisma.$disconnect();
      
      if (redis) {
        await redis.disconnect();
      }
      
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});