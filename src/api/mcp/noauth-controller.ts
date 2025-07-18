import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AuthService } from '@/services/auth.service';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/database';
import { getInitializedCMIService } from '@/index';
import { ModuleRegistry } from '@/core/modules/registry.service';

const router = Router();
const authService = AuthService.getInstance();

// Override well-known OAuth endpoints for token-based URLs
router.get('/:token/.well-known/oauth-authorization-server', async (req: Request, res: Response) => {
  const token = req.params.token;
  
  // Validate token
  const authResult = await authService.validateToken(token);
  if (!authResult) {
    return res.status(404).end();
  }
  
  // Return 404 to indicate OAuth is not available for token-based auth
  res.status(404).end();
});

router.get('/:token/.well-known/oauth-protected-resource', async (req: Request, res: Response) => {
  const token = req.params.token;
  
  // Validate token
  const authResult = await authService.validateToken(token);
  if (!authResult) {
    return res.status(404).end();
  }
  
  // Return 404 to indicate OAuth is not available for token-based auth
  res.status(404).end();
});

// Store SSE connections for message forwarding
interface SSEConnection {
  response: Response;
  sessionId: string;
  token: string;
  userId: string;
}

const sseConnections = new Map<string, SSEConnection>();

/**
 * SSE endpoint with token in URL (BigMemory pattern)
 * GET /:token/sse
 */
router.get('/:token/sse', async (req: Request, res: Response) => {
  const token = req.params.token;
  const sessionId = randomUUID();
  
  try {
    // Validate token
    const authResult = await authService.validateToken(token);
    if (!authResult) {
      return res.status(404).end(); // Don't leak token validity
    }
    
    const userId = authResult.userId;
    
    // Set SSE headers exactly like BigMemory
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    });
    
    // Store connection
    const connectionKey = `${token}:${sessionId}`;
    sseConnections.set(connectionKey, {
      response: res,
      sessionId,
      token,
      userId
    });
    
    // Send endpoint event (BigMemory pattern)
    const endpointUrl = `/${token}/messages/${sessionId}?sessionId=${sessionId}`;
    res.write(`event: endpoint\ndata: ${endpointUrl}\n\n`);
    
    // Ensure data is sent immediately
    if ((res as any).flush) (res as any).flush();
    
    // Keep alive with colons (BigMemory pattern)
    const keepAlive = setInterval(() => {
      res.write(':\n\n');
      if ((res as any).flush) (res as any).flush();
    }, 15000);
    
    // Cleanup on disconnect
    req.on('close', () => {
      clearInterval(keepAlive);
      sseConnections.delete(connectionKey);
      logger.info('SSE connection closed', { token: token.substring(0, 8) + '...', sessionId });
    });
    
    logger.info('SSE connection established', { 
      userId, 
      sessionId,
      token: token.substring(0, 8) + '...'
    });
    
  } catch (error) {
    logger.error('SSE setup error', { error });
    if (!res.headersSent) {
      res.status(500).end();
    }
  }
});

/**
 * Messages endpoint with token in URL (BigMemory pattern)
 * POST /:token/messages/:sessionId
 * 
 * This follows the "muppet-style" pattern:
 * - Always returns empty HTTP response immediately
 * - Sends actual response via SSE connection
 */
router.post('/:token/messages/:sessionId', async (req: Request, res: Response) => {
  const { token, sessionId } = req.params;
  const { method, params, id } = req.body;
  
  logger.info('MCP request', { 
    token: token.substring(0, 8) + '...', 
    sessionId, 
    method 
  });
  
  // Find SSE connection
  const connectionKey = `${token}:${sessionId}`;
  const sseConnection = sseConnections.get(connectionKey);
  
  // Always return empty response immediately (BigMemory pattern)
  res.status(200).send('');
  
  // If no SSE connection, we're done
  if (!sseConnection) {
    logger.warn('No SSE connection for session', { sessionId });
    return;
  }
  
  // Process the request and send response via SSE
  try {
    let response: any;
    
    if (method === 'initialize') {
      response = {
        jsonrpc: '2.0',
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {
              listChanged: false
            },
            prompts: {
              listChanged: false
            },
            resources: {
              subscribe: false,
              listChanged: false
            }
          },
          serverInfo: {
            name: 'Federated Memory MCP',
            version: '1.0.0'
          }
        },
        id
      };
    } else if (method === 'initialized') {
      // Notification - no response needed
      logger.info('Client initialized', { sessionId });
      return;
    } else if (method === 'tools/list') {
      response = {
        jsonrpc: '2.0',
        result: {
          tools: [
            {
              name: 'searchMemory',
              description: 'Search across federated memory modules',
              inputSchema: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'What to search for'
                  },
                  modules: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Specific modules to search (optional)'
                  },
                  limit: {
                    type: 'number',
                    description: 'Maximum results (default: 10)'
                  }
                },
                required: ['query']
              }
            },
            {
              name: 'storeMemory',
              description: 'Store information in federated memory',
              inputSchema: {
                type: 'object',
                properties: {
                  content: {
                    type: 'string',
                    description: 'The information to remember'
                  },
                  metadata: {
                    type: 'object',
                    description: 'Additional context or tags'
                  }
                },
                required: ['content']
              }
            },
            {
              name: 'listModules',
              description: 'List available memory modules',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'getModuleStats',
              description: 'Get statistics for memory modules',
              inputSchema: {
                type: 'object',
                properties: {
                  moduleId: {
                    type: 'string',
                    description: 'Module ID (optional, returns all if not specified)'
                  }
                }
              }
            }
          ]
        },
        id
      };
    } else if (method === 'prompts/list') {
      // Return empty prompts list
      response = {
        jsonrpc: '2.0',
        result: {
          prompts: []
        },
        id
      };
    } else if (method === 'tools/call') {
      const { name, arguments: args } = params;
      
      try {
        const userId = sseConnection.userId;
        let result: any;
        
        if (name === 'searchMemory') {
          // Search across federated modules
          const cmiService = getInitializedCMIService();
          const searchResult = await cmiService.search(userId, args.query, {
            limit: args.limit || 10,
            modules: args.modules
          });
          
          result = {
            results: searchResult.results.map((r: any) => ({
              content: r.content,
              moduleId: r.moduleId,
              similarity: r.similarity,
              metadata: r.metadata,
              timestamp: r.timestamp
            })),
            query: args.query,
            count: searchResult.results.length,
            message: searchResult.results.length > 0 
              ? `Found ${searchResult.results.length} memories`
              : 'No memories found matching your query'
          };
        } else if (name === 'storeMemory') {
          // Store in appropriate module via CMI
          const cmiService = getInitializedCMIService();
          const storedMemory = await cmiService.store(userId, {
            content: args.content,
            metadata: args.metadata || {},
            source: 'mcp'
          });
          
          result = {
            success: true,
            message: 'Memory stored successfully',
            memoryId: storedMemory.id,
            moduleId: storedMemory.moduleId
          };
        } else if (name === 'listModules') {
          // List available modules
          const moduleRegistry = ModuleRegistry.getInstance();
          const modules = await moduleRegistry.listModules();
          
          result = {
            modules: modules.map(m => ({
              id: m.id,
              name: m.name,
              description: m.description,
              type: m.type
            })),
            count: modules.length
          };
        } else if (name === 'getModuleStats') {
          // Get module statistics
          const stats = await prisma.memoryIndex.groupBy({
            by: ['moduleId'],
            where: args.moduleId ? { moduleId: args.moduleId, userId } : { userId },
            _count: true
          });
          
          result = {
            stats: stats.map(s => ({
              moduleId: s.moduleId,
              memoryCount: s._count
            })),
            total: stats.reduce((sum, s) => sum + s._count, 0)
          };
        } else {
          response = {
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: `Unknown tool: ${name}`
            },
            id
          };
        }
        
        if (result) {
          response = {
            jsonrpc: '2.0',
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            },
            id
          };
        }
      } catch (error) {
        response = {
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          },
          id
        };
      }
    } else {
      response = {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Method not found: ${method}`
        },
        id
      };
    }
    
    // Send response via SSE as a message event
    if (response) {
      sseConnection.response.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
      if ((sseConnection.response as any).flush) {
        (sseConnection.response as any).flush();
      }
    }
    
  } catch (error) {
    logger.error('Error processing MCP request', { error, method });
    
    // Send error via SSE
    const errorResponse = {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error'
      },
      id
    };
    
    sseConnection.response.write(`event: message\ndata: ${JSON.stringify(errorResponse)}\n\n`);
    if ((sseConnection.response as any).flush) {
      (sseConnection.response as any).flush();
    }
  }
});

// CORS preflight handlers
router.options('/:token/sse', (_req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

router.options('/:token/messages/:sessionId', (_req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Config endpoint for token-based auth (no OAuth needed)
router.get('/:token/config', async (req: Request, res: Response) => {
  const token = req.params.token;
  
  // Validate token
  const authResult = await authService.validateToken(token);
  if (!authResult) {
    return res.status(404).end();
  }
  
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  
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
        type: 'sse',
        endpoint: `${baseUrl}/${token}/sse`,
      }
      // No auth section - authentication is via token in URL
    },
  });
});

// Simple info endpoint
router.get('/:token', async (req: Request, res: Response) => {
  const token = req.params.token;
  
  // Validate token
  const authResult = await authService.validateToken(token);
  if (!authResult) {
    return res.status(404).end();
  }
  
  res.json({
    message: 'Federated Memory MCP Server',
    sseEndpoint: `/${token}/sse`,
    status: 'ready'
  });
});

export default router;