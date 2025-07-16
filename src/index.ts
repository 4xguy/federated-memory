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
import { createRedisSessionMiddleware, upgradeToRedisSession } from './api/middleware/session-redis';
import { initializePassport } from './services/oauth-strategies/passport.config';

// Initialize Prisma
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Initialize services - these will be set in main()
let moduleRegistry: ModuleRegistry;
let cmiService: any = null;
let moduleLoader: ModuleLoader;

// Initialize basic services that don't depend on modules
try {
  moduleRegistry = ModuleRegistry.getInstance();
  moduleLoader = ModuleLoader.getInstance();
} catch (error) {
  logger.error('Failed to initialize basic services', { error });
  // Create dummy instances to prevent crashes
  moduleRegistry = {} as ModuleRegistry;
  moduleLoader = {} as ModuleLoader;
}

// Export a getter for CMI service that initializes it lazily
export function getInitializedCMIService() {
  if (!cmiService) {
    cmiService = getCMIService();
  }
  return cmiService;
}

export { moduleRegistry, cmiService, moduleLoader };

async function main() {
  try {
    logger.info('Starting Federated Memory Server...');
    logger.info('Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'not set',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'set' : 'not set',
      JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'not set',
      SESSION_SECRET: process.env.SESSION_SECRET ? 'set' : 'not set',
    });

    // Connect to database
    try {
      await prisma.$connect();
      logger.info('Connected to PostgreSQL database');
    } catch (error) {
      logger.error('Failed to connect to database', { error });
      // Continue anyway - health check should still work
    }

    // Connect to Redis if configured
    const redis = Redis.getInstance();
    if (redis) {
      await redis.connect();
      logger.info('Connected to Redis');
      
      // Try to upgrade session middleware to use Redis
      const upgraded = await upgradeToRedisSession();
      if (upgraded) {
        logger.info('Session storage upgraded to Redis');
      }
    }

    // Load active modules (but don't fail if they can't load)
    let moduleResults: any[] = [];
    try {
      moduleResults = await moduleLoader.loadAllModules();
      const successfulModules = moduleResults.filter(r => r.success).length;
      logger.info(`Loaded ${successfulModules} modules successfully`);
      
      // Initialize CMI service AFTER modules are loaded
      if (successfulModules > 0) {
        cmiService = getCMIService();
        logger.info('CMI service initialized after module loading');
      }
    } catch (error) {
      logger.error('Failed to load modules, continuing without them', { error });
      // Continue without modules - server can still run for health checks
    }

    // Initialize Express app
    const app = express();
    const server = createServer(app);
    const port = process.env.PORT || 3000;

    // Add health check BEFORE any middleware to ensure it always works
    app.get('/api/health', (_req, res) => {
      try {
        res.status(200).json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          service: 'federated-memory',
        });
      } catch (e) {
        // If even JSON fails, send plain text
        res.status(200).send('OK');
      }
    });

    // Also add root health check in case Railway checks there
    app.get('/health', (_req, res) => {
      try {
        res.status(200).json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          service: 'federated-memory',
        });
      } catch (e) {
        res.status(200).send('OK');
      }
    });

    // Add root endpoint
    app.get('/', (_req, res) => {
      res.status(200).json({
        message: 'Federated Memory Server',
        health: '/api/health',
        version: '1.0.0',
      });
    });

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
            'http://localhost:6274', // MCP Inspector
            'http://127.0.0.1:6274', // MCP Inspector
            'https://mcp-inspector.vercel.app', // MCP Inspector hosted
            'https://*.vercel.app', // Vercel apps
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
            // For development/debugging, log the rejected origin
            logger.warn('CORS rejected origin:', origin);
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Mcp-Session-Id', 'x-mcp-proxy-auth', 'X-MCP-Proxy-Auth', 'mcp-protocol-version', 'MCP-Protocol-Version'],
        exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'WWW-Authenticate', 'Mcp-Session-Id'],
      }),
    );

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies for OAuth

    // Session middleware (must be before passport) - Using Redis-aware version
    app.use(createRedisSessionMiddleware());

    // Initialize Passport for OAuth
    const passport = initializePassport();
    app.use(passport.initialize());
    app.use(passport.session());

    // Handle OPTIONS preflight requests for all routes
    app.options('*', (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, x-mcp-proxy-auth, X-MCP-Proxy-Auth, mcp-protocol-version, MCP-Protocol-Version');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.status(204).send();
    });

    // Handle favicon requests
    app.get('/favicon.ico', (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.status(204).send(); // No content
    });
    
    // Config endpoint for MCP clients (root level)
    app.get('/config', async (req, res) => {
      try {
        const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
        
        // Set CORS headers for all origins
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-mcp-proxy-auth, X-MCP-Proxy-Auth');
        
        res.json({
          mcp: {
            version: '1.0.0',
            serverInfo: {
              name: 'federated-memory',
              version: '1.0.0',
              description: 'Distributed memory system for LLMs with intelligent routing',
            },
            capabilities: {
              tools: true,
              resources: false,
              prompts: true,
              sampling: false,
            },
            transport: {
              type: 'streamable-http',
              endpoint: `${baseUrl}/mcp`,
            },
            auth: {
              type: 'oauth2',
              authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
              token_endpoint: `${baseUrl}/api/oauth/token`,
              scopes_supported: ['read', 'write', 'profile'],
              code_challenge_methods_supported: ['S256'],
              client_id: 'mcp-client',
            },
          },
        });
      } catch (error) {
        logger.error('Error serving config endpoint', error);
        // Send CORS headers even on error
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Health endpoint (root level)
    app.get('/health', async (req, res) => {
      try {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-mcp-proxy-auth, X-MCP-Proxy-Auth');
        
        // Check database connectivity
        await prisma.$queryRaw`SELECT 1`;
        
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'federated-memory',
          version: '1.0.0',
        });
      } catch (error) {
        logger.error('Health check failed', error);
        // Send CORS headers even on error
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(503).json({ 
          status: 'unhealthy',
          error: 'Database connection failed',
          timestamp: new Date().toISOString(),
        });
      }
    });
    
    // MCP Proxy health endpoint (for MCP Inspector compatibility)
    app.get('/mcp-proxy/health', async (req, res) => {
      try {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-mcp-proxy-auth, X-MCP-Proxy-Auth');
        
        // Check database connectivity
        await prisma.$queryRaw`SELECT 1`;
        
        // Return simple OK status for MCP Inspector
        res.status(200).send('OK');
      } catch (error) {
        logger.error('MCP proxy health check failed', error);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(503).send('Service Unavailable');
      }
    });

    // Well-known endpoints (OAuth discovery) - must be at root level
    app.get('/.well-known/oauth-authorization-server', (req, res) => {
      try {
        const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
        
        // Set CORS headers explicitly for well-known endpoints
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-protocol-version, MCP-Protocol-Version');
        
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
      } catch (error) {
        logger.error('Error serving oauth-authorization-server', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/.well-known/oauth-protected-resource', (req, res) => {
      try {
        const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
        
        // Set CORS headers explicitly for well-known endpoints
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-protocol-version, MCP-Protocol-Version');
        
        res.json({
          resource_server: baseUrl,
          authorization_servers: [baseUrl],
          scopes_supported: ['read', 'write', 'profile'],
          bearer_methods_supported: ['header', 'query'],
          resource_documentation: 'https://github.com/yourusername/federated-memory',
        });
      } catch (error) {
        logger.error('Error serving oauth-protected-resource', { error });
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Serve test OAuth page in development
    if (process.env.NODE_ENV === 'development') {
      app.get('/test-oauth.html', (_req, res) => {
        res.sendFile('test-oauth.html', { root: process.cwd() });
      });
    }
    
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

      try {
        if (moduleLoader && moduleLoader.cleanup) {
          await moduleLoader.cleanup();
        }
      } catch (error) {
        logger.error('Error during module cleanup', { error });
      }

      try {
        if (cmiService && cmiService.cleanup) {
          await cmiService.cleanup();
        }
      } catch (error) {
        logger.error('Error during CMI cleanup', { error });
      }

      try {
        await prisma.$disconnect();
      } catch (error) {
        logger.error('Error disconnecting from database', { error });
      }

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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
