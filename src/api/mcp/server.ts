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
  // Skip for health endpoints
  app.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/mcp/health' || req.path === '/sse/health') {
      return next();
    }
    mcpOAuthMiddleware(req, res, next);
  });

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
        onsessioninitialized: (id: string) => {
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
  
  // SSE endpoint DELETE for session termination
  app.delete('/sse', async (req: Request, res: Response) => {
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

    res.status(204).send();
  });
  
  // MCP Proxy Server health check (for MCP Inspector)
  app.get('/health', (_req: Request, res: Response) => {
    // Set CORS headers explicitly
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-mcp-proxy-auth, X-MCP-Proxy-Auth');
    
    // Return simple health check response
    res.status(200).json({ status: 'ok' });
  });
  
  // MCP transport health check - no auth required
  app.get('/mcp/health', (_req: Request, res: Response) => {
    // Set CORS headers for MCP Inspector
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-mcp-proxy-auth, X-MCP-Proxy-Auth, mcp-protocol-version');
    
    res.json({
      status: 'healthy',
      transport: 'streamable-http',
      authenticated: false,
      capabilities: {
        tools: true,
        resources: false,
        prompts: true,
        sampling: false,
      },
    });
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

  // SSE health check endpoint
  app.get('/sse/health', (_req: Request, res: Response) => {
    // Set CORS headers explicitly for MCP Inspector
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-mcp-proxy-auth, X-MCP-Proxy-Auth, mcp-protocol-version, MCP-Protocol-Version');
    
    res.json({
      status: 'healthy',
      transport: 'streamable-http',
      endpoints: {
        info: '/sse/info',
        stream: '/sse',
      },
    });
  });
  
  // MCP server info endpoint (required for remote MCP servers)
  app.get('/sse/info', (_req: Request, res: Response) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
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
        client_id: 'claude-ai',
      },
    });
  });

  // SSE endpoint for MCP transport
  app.post('/sse', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    let transport: StreamableHTTPServerTransport;
    let mcpServer: McpServer;

    // Check for existing session
    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId)!;
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // Create new session
      const newSessionId = randomUUID();
      logger.info('Creating new MCP session via SSE', { 
        sessionId: newSessionId,
        origin: req.headers.origin,
        userAgent: req.headers['user-agent'],
        method: req.body?.method 
      });
      
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        onsessioninitialized: (id: string) => {
          logger.info('MCP session initialized via SSE', { sessionId: id });
          transports.set(id, transport);
        },
        enableDnsRebindingProtection: false,
        allowedHosts: [
          '127.0.0.1',
          'localhost',
          'claude.ai',
          '*.claude.ai',
          '*.anthropic.com',
          process.env.BASE_URL?.replace(/^https?:\/\//, '') || '',
        ].filter(Boolean),
      });

      transport.onclose = () => {
        logger.info('MCP session closed via SSE', { sessionId: transport.sessionId });
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
        logger.info('MCP server connected via SSE', { 
          sessionId: newSessionId,
          hasAuth: !!userContext,
          userId: userContext?.userId 
        });
      } catch (error) {
        logger.error('Failed to connect MCP server via SSE', { error, sessionId: newSessionId });
        throw error;
      }
    } else {
      // Session required but not provided
      logger.warn('SSE request without session ID', { 
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
      logger.error('Error handling SSE request', { 
        error, 
        sessionId,
        method: req.body?.method 
      });
      throw error;
    }
  });

  // SSE endpoint GET for server-sent events
  app.get('/sse', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    
    // For initial connection without session ID, this is OK
    if (!sessionId) {
      // Set SSE headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      
      // Keep connection open but don't send data yet
      const keepAlive = setInterval(() => {
        res.write(':keep-alive\n\n');
      }, 30000);
      
      req.on('close', () => {
        clearInterval(keepAlive);
        logger.info('SSE connection closed without session');
      });
      
      return;
    }
    
    // If session ID is provided, handle it
    const transport = transports.get(sessionId);
    if (!transport) {
      return res.status(400).json({
        error: {
          code: -32000,
          message: 'Invalid session',
          data: { type: 'invalid_session' },
        },
      });
    }

    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      logger.error('Error handling SSE GET request', { error, sessionId });
      res.status(500).json({
        error: {
          code: -32603,
          message: 'Internal error',
        },
      });
    }
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
    
    // Special handling for MCP Inspector user
    if (userId === 'mcp-inspector-user') {
      return {
        userId: 'mcp-inspector-user',
        email: 'mcp-inspector@example.com',
        name: 'MCP Inspector'
      };
    }
    
    // Get user details from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    });
    
    if (!user) return undefined;
    
    return {
      userId: user.id,
      email: user.email || 'no-email@example.com', // Default for users without email
      name: user.name || undefined
    };
  } catch (error) {
    logger.error('Failed to extract user context from auth', { error });
  }

  return undefined;
}
