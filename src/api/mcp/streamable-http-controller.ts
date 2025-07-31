import { Request, Response, Router } from 'express';
import { AuthService } from '@/services/auth.service';
import { logger } from '@/utils/logger';
import { getInitializedCMIService } from '../../index';
import { getToolsListForUser } from './tools-list';
import { executeToolForUser } from './tool-executor';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { randomUUID } from 'crypto';

const router = Router();
const authService = AuthService.getInstance();

// Map to store transports by session ID
const transports: Record<string, StreamableHTTPServerTransport> = {};

/**
 * Modern MCP endpoint using Streamable HTTP transport
 * This follows the latest MCP best practices for Claude integration
 */
router.post('/:token/mcp', async (req: Request, res: Response) => {
  const token = req.params.token;
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  
  try {
    // Validate token
    const authResult = await authService.validateToken(token);
    if (!authResult) {
      return res.status(404).end(); // Don't leak token validity
    }
    
    const userId = authResult.userId;
    let transport: StreamableHTTPServerTransport;
    
    // Check for existing session
    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // Create new session for initialization
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          // Store transport by session ID
          transports[sid] = transport;
          logger.info('MCP session initialized', { sessionId: sid, userId });
        },
        // Enable JSON response mode for simpler handling
        enableJsonResponse: false, // Keep SSE support for notifications
        // Security settings
        enableDnsRebindingProtection: true,
        allowedHosts: ['127.0.0.1', 'localhost', 'localhost:3003', 'claude.ai', '*.claude.ai'],
      });
      
      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
          logger.info('MCP session closed', { sessionId: transport.sessionId });
        }
      };
      
      // Create MCP server instance
      const mcpServer = await createMcpServerForUser(userId);
      
      // Connect server to transport
      await mcpServer.connect(transport);
    } else {
      // Invalid request - no session ID for non-initialize request
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Session ID required for non-initialize requests',
        },
        id: null,
      });
    }
    
    // Handle the request using the transport
    await transport.handleRequest(req, res, req.body);
    
  } catch (error) {
    logger.error('MCP request error', { error, token, method: req.body?.method });
    
    // Return error in proper JSON-RPC format
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal server error',
        },
        id: req.body?.id || null,
      });
    }
  }
});

/**
 * Handle SSE requests for server-to-client notifications
 * This is part of the Streamable HTTP transport spec
 */
router.get('/:token/mcp', async (req: Request, res: Response) => {
  const token = req.params.token;
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  
  try {
    // Validate token
    const authResult = await authService.validateToken(token);
    if (!authResult) {
      return res.status(404).end();
    }
    
    if (!sessionId || !transports[sessionId]) {
      return res.status(400).send('Invalid or missing session ID');
    }
    
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
    
  } catch (error) {
    logger.error('MCP SSE error', { error, token });
    res.status(500).end();
  }
});

/**
 * Handle session termination
 */
router.delete('/:token/mcp', async (req: Request, res: Response) => {
  const token = req.params.token;
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  
  try {
    // Validate token
    const authResult = await authService.validateToken(token);
    if (!authResult) {
      return res.status(404).end();
    }
    
    if (!sessionId || !transports[sessionId]) {
      return res.status(400).send('Invalid or missing session ID');
    }
    
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
    
  } catch (error) {
    logger.error('MCP delete error', { error, token });
    res.status(500).end();
  }
});

// Health check endpoint
router.get('/:token/mcp/health', async (req: Request, res: Response) => {
  const token = req.params.token;
  
  try {
    const authResult = await authService.validateToken(token);
    if (!authResult) {
      return res.status(404).end();
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      transport: 'streamable-http',
      protocolVersion: '2025-03-26',
      activeSessions: Object.keys(transports).length,
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Helper to check if request is an initialize request
 */
function isInitializeRequest(body: any): boolean {
  return body?.method === 'initialize';
}

/**
 * Create an MCP server instance for a specific user
 */
async function createMcpServerForUser(userId: string): Promise<McpServer> {
  const mcpServer = new McpServer({
    name: 'federated-memory',
    version: '1.0.0',
  });
  
  // Get tools for this user
  const tools = await getToolsListForUser(userId);
  
  // Register each tool
  for (const tool of tools) {
    mcpServer.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema as any,
      },
      async (extra: any) => {
        try {
          const result = await executeToolForUser(tool.name, extra.request.params.arguments || {}, userId);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          throw error; // Let MCP SDK handle error formatting
        }
      }
    );
  }
  
  return mcpServer;
}

export default router;