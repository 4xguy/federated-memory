import 'dotenv/config';
import 'module-alias/register';
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
import restApiRoutes from './api/rest';
import { createMcpApp } from './api/mcp';

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
    app.use(
      helmet({
        crossOriginEmbedderPolicy: false, // Allow SSE connections
      }),
    );

    // CORS configuration for Claude.ai and other clients
    app.use(
      cors({
        origin: (origin, callback) => {
          const allowedOrigins = [
            'https://claude.ai',
            'https://*.claude.ai',
            'http://localhost:3001', // Local frontend
            'http://localhost:3000', // Local dev
          ];

          // Allow requests with no origin (like mobile apps or curl)
          if (!origin) return callback(null, true);

          // Check if origin matches any allowed pattern
          const allowed = allowedOrigins.some(pattern => {
            if (pattern.includes('*')) {
              const regex = new RegExp(pattern.replace('*', '.*'));
              return regex.test(origin);
            }
            return pattern === origin;
          });

          if (allowed) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      }),
    );

    app.use(express.json({ limit: '10mb' }));

    // Well-known endpoints (OAuth discovery) - must be at root level
    app.get('/.well-known/oauth-authorization-server', (req, res) => {
      const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
      res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
        token_endpoint: `${baseUrl}/api/oauth/token`,
        token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
        token_endpoint_auth_signing_alg_values_supported: ['RS256'],
        userinfo_endpoint: `${baseUrl}/api/oauth/userinfo`,
        jwks_uri: `${baseUrl}/api/oauth/jwks`,
        registration_endpoint: `${baseUrl}/api/oauth/register`,
        scopes_supported: ['read', 'write', 'profile', 'openid'],
        response_types_supported: ['code'],
        response_modes_supported: ['query'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        revocation_endpoint: `${baseUrl}/api/oauth/revoke`,
        revocation_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
        introspection_endpoint: `${baseUrl}/api/oauth/introspect`,
        introspection_endpoint_auth_methods_supported: ['client_secret_post', 'bearer'],
        service_documentation: 'https://github.com/yourusername/federated-memory',
        ui_locales_supported: ['en-US'],
      });
    });

    app.get('/.well-known/oauth-protected-resource', (req, res) => {
      const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
      res.json({
        resource_server: baseUrl,
        authorization_servers: [baseUrl],
        scopes_supported: ['read', 'write', 'profile'],
        bearer_methods_supported: ['header', 'query'],
        resource_documentation: 'https://github.com/yourusername/federated-memory',
      });
    });

    // REST API routes
    app.use('/api', restApiRoutes);

    // MCP Streamable HTTP server
    const mcpApp = createMcpApp();
    app.use(mcpApp);

    // Error handling
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });

    // Start server
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
      logger.info(`Federated Memory System running on port ${port}`);
      logger.info(`REST API: http://localhost:${port}/api`);
      logger.info(`MCP Streamable HTTP: http://localhost:${port}/mcp`);
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

main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
