import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './utils/logger';
import { Redis } from './utils/redis';
import { createSessionMiddleware } from './api/middleware/session';
import { initializePassport } from './services/oauth-strategies/passport.config';

const prisma = new PrismaClient();

async function main() {
  try {
    logger.info('Starting Ultra-Minimal Federated Memory Server...');
    
    // Connect to database
    try {
      await prisma.$connect();
      logger.info('Connected to PostgreSQL database');
    } catch (error) {
      logger.error('Failed to connect to database', error);
      // Continue anyway - health check should still work
    }
    
    // Connect to Redis if configured
    const redis = Redis.getInstance();
    if (redis) {
      await redis.connect();
      logger.info('Connected to Redis');
    }
    
    const app = express();
    const server = createServer(app);
    const port = process.env.PORT || 3000;

    // Add middleware
    app.use(helmet({
      crossOriginEmbedderPolicy: false, // Allow SSE connections
    }));
    
    app.use(cors({
      origin: true, // Allow all origins for now
      credentials: true,
    }));
    
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    
    // Session middleware (must be before passport)
    app.use(createSessionMiddleware());
    
    // Initialize Passport for OAuth - TEMPORARILY DISABLED to isolate issue
    // const passport = initializePassport();
    // app.use(passport.initialize());
    // app.use(passport.session());
    
    logger.info('Middleware and session initialized (OAuth temporarily disabled)');

    // Health check endpoint
    app.get('/api/health', (_req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'federated-memory-ultra-minimal',
      });
    });

    // Also add root health check
    app.get('/health', (_req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'federated-memory-ultra-minimal',
      });
    });

    // Root endpoint
    app.get('/', (_req, res) => {
      res.status(200).json({
        message: 'Ultra-Minimal Federated Memory Server',
        health: '/api/health',
        version: '1.0.0',
      });
    });

    // Start server
    server.listen(port, () => {
      logger.info(`Ultra-Minimal server running on port ${port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('HTTP server closed');
      });
      
      try {
        await prisma.$disconnect();
      } catch (error) {
        console.error('Error disconnecting from database', error);
      }
      
      const redis = Redis.getInstance();
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

main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});