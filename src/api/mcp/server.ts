import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/database';
import { AuthService } from '@/services/auth.service';
import { createAuthenticatedMcpServer } from './authenticated-server';
import { mcpOAuthMiddleware } from './oauth-middleware';

// Transport storage for session management
const transports = new Map<string, StreamableHTTPServerTransport>();

// Create MCP Server instance with optional user context
export function createMcpServer(userContext?: { userId: string; email: string; name?: string }) {
  // Use the new authenticated server pattern
  const server = createAuthenticatedMcpServer(userContext);

  // All tool registration is now handled in authenticated-server.ts
  return server;
}

// Create Express app for MCP server
export function createMcpApp() {
  const app = express();

  // Enable CORS for browser clients with WebSocket support
  app.use(
    cors({
      origin: (origin, callback) => {
        const allowedOrigins = [
          'http://localhost:*',
          'https://claude.ai',
          'https://*.claude.ai',
          'https://*.anthropic.com',
          'wss://claude.ai',
          'wss://*.claude.ai',
        ];
        
        // Allow requests with no origin (like WebSocket upgrades)
        if (!origin) return callback(null, true);
        
        // Check if origin matches any allowed pattern
        const allowed = allowedOrigins.some(pattern => {
          if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace('*', '.*'));
            return regex.test(origin);
          }
          return pattern === origin;
        });
        
        callback(null, allowed);
      },
      credentials: true,
      exposedHeaders: ['Mcp-Session-Id', 'WWW-Authenticate'],
      allowedHeaders: [
        'Content-Type', 
        'Mcp-Session-Id', 
        'Authorization', 
        'Last-Event-ID',
        'Upgrade',
        'Connection',
        'Sec-WebSocket-Key',
        'Sec-WebSocket-Version',
        'Sec-WebSocket-Extensions',
      ],
      methods: ['GET', 'POST', 'OPTIONS'],
    }),
  );

  app.use(express.json());
  
  // Apply OAuth middleware to intercept authentication errors
  app.use(mcpOAuthMiddleware);

  // Handle MCP requests
  app.post('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    let transport: StreamableHTTPServerTransport;
    let mcpServer: McpServer;

    // Check for existing session
    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId)!;
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // Create new session
      const newSessionId = randomUUID();
      logger.info('Creating new MCP session', { 
        sessionId: newSessionId,
        origin: req.headers.origin,
        userAgent: req.headers['user-agent'],
        method: req.body?.method 
      });
      
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        onsessioninitialized: id => {
          logger.info('MCP session initialized', { sessionId: id });
          transports.set(id, transport);
        },
        enableDnsRebindingProtection: false, // Disable for Claude.ai compatibility
        allowedHosts: [
          '127.0.0.1',
          'localhost',
          'localhost:3001',
          'localhost:3000',
          'claude.ai',
          '*.claude.ai',
          '*.anthropic.com',
          process.env.BASE_URL?.replace(/^https?:\/\//, '') || '',
        ].filter(Boolean),
      });

      transport.onclose = () => {
        logger.info('MCP session closed', { sessionId: transport.sessionId });
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
        }
      };

      // Extract user context from auth header if available
      const authHeader = req.headers.authorization;
      const userContext = await extractUserContextFromAuth(authHeader);

      // Create MCP server with user context
      mcpServer = createMcpServer(userContext);
      
      try {
        await mcpServer.connect(transport);
        logger.info('MCP server connected', { 
          sessionId: newSessionId,
          hasAuth: !!userContext,
          userId: userContext?.userId 
        });
      } catch (error) {
        logger.error('Failed to connect MCP server', { error, sessionId: newSessionId });
        throw error;
      }
    } else {
      // Session required but not provided
      logger.warn('MCP request without session ID', { 
        hasSessionId: !!sessionId,
        isInitialize: isInitializeRequest(req.body),
        method: req.body?.method 
      });
      
      res.status(400).json({
        error: {
          code: -32000,
          message: 'Session ID required for non-initialize requests',
        },
      });
      return;
    }

    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('Error handling MCP request', { 
        error, 
        sessionId,
        method: req.body?.method 
      });
      throw error;
    }
  });

  // Handle SSE requests for server-initiated messages
  app.get('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string;

    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({
        error: {
          code: -32000,
          message: 'Invalid or missing session ID',
        },
      });
      return;
    }

    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
  });

  // Handle session termination
  app.delete('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string;

    if (!sessionId || !transports.has(sessionId)) {
      res.status(404).json({
        error: {
          code: -32000,
          message: 'Session not found',
        },
      });
      return;
    }

    const transport = transports.get(sessionId)!;
    await transport.close();
    transports.delete(sessionId);

    res.status(200).json({ message: 'Session terminated' });
  });

  // Health check for MCP
  app.get('/mcp/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      protocol: 'streamable-http',
      sessions: transports.size,
      capabilities: {
        tools: true,
        resources: true,
        prompts: true,
        sampling: false,
      },
    });
  });

  // MCP server info endpoint (required for remote MCP servers)
  app.get('/sse/info', (_req: Request, res: Response) => {
    res.json({
      mcp: {
        version: '2025-03-26',
        serverInfo: {
          name: 'federated-memory',
          version: '1.0.0',
          description: 'Distributed memory system for LLMs with intelligent routing',
        },
        capabilities: {
          tools: true,
          resources: true,
          prompts: true,
          sampling: false,
        },
      },
      auth: {
        type: 'oauth2',
        authorization_endpoint: `${process.env.BASE_URL || 'http://localhost:3000'}/api/oauth/authorize`,
        token_endpoint: `${process.env.BASE_URL || 'http://localhost:3000'}/api/oauth/token`,
        scopes_supported: ['read', 'write', 'profile'],
        code_challenge_methods_supported: ['S256'],
      },
    });
  });

  return app;
}

// Helper functions
function isInitializeRequest(body: any): boolean {
  return body?.method === 'initialize';
}

async function extractUserContextFromAuth(authHeader?: string): Promise<{ userId: string; email: string; name?: string } | undefined> {
  if (!authHeader) return undefined;

  try {
    const authService = AuthService.getInstance();
    const userId = await authService.extractUserId(authHeader);
    
    if (!userId) return undefined;
    
    // Get user details from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    });
    
    if (!user) return undefined;
    
    return {
      userId: user.id,
      email: user.email,
      name: user.name || undefined
    };
  } catch (error) {
    logger.error('Failed to extract user context from auth', { error });
  }

  return undefined;
}
