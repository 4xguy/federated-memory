import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/database';
import { getCMIService } from '@/core/cmi/index.service';
import { ModuleRegistry } from '@/core/modules/registry.service';
import { completable } from '@modelcontextprotocol/sdk/server/completable';

// Transport storage for session management
const transports = new Map<string, StreamableHTTPServerTransport>();

// Create MCP Server instance
export function createMcpServer(userId?: string) {
  const server = new McpServer({
    name: 'federated-memory',
    version: '1.0.0',
  });

  // Get service instances
  const cmiService = getCMIService();
  const moduleRegistry = ModuleRegistry.getInstance();

  // Register memory search tool
  server.registerTool(
    'searchMemories',
    {
      title: 'Search Memories',
      description: 'Search across all memory modules using semantic search',
      inputSchema: {
        query: z.string().describe('Search query'),
        limit: z.number().optional().default(10).describe('Maximum results'),
        moduleId: z.string().optional().describe('Specific module to search'),
      },
    },
    async ({ query, limit, moduleId }) => {
      try {
        const results = await cmiService.search(
          userId || 'anonymous',
          query,
          { limit, moduleId }
        );

        const formattedResults = results.map((r: any) => ({
          id: r.id,
          content: r.content,
          module: r.moduleId,
          similarity: r.similarity,
          metadata: r.metadata,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formattedResults, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP search error', { error });
        return {
          content: [
            {
              type: 'text',
              text: `Error searching memories: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register memory storage tool
  server.registerTool(
    'storeMemory',
    {
      title: 'Store Memory',
      description: 'Store a new memory in the appropriate module',
      inputSchema: {
        content: z.string().describe('Memory content'),
        metadata: z.record(z.any()).optional().describe('Memory metadata'),
        moduleId: completable(
          z.string().optional(),
          async (value) => {
            const modules = await moduleRegistry.listModules();
            return modules
              .map(m => m.id)
              .filter(id => id.startsWith(value || ''));
          }
        ).describe('Target module (auto-routed if not specified)'),
      },
    },
    async ({ content, metadata, moduleId }) => {
      try {
        const memoryId = await cmiService.store(
          userId || 'anonymous',
          content,
          metadata,
          moduleId
        );

        return {
          content: [
            {
              type: 'text',
              text: `Memory stored successfully: ${memoryId}`,
            },
          ],
        };
      } catch (error) {
        logger.error('MCP store error', { 
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          userId: userId || 'anonymous',
          content: content.substring(0, 100),
          moduleId
        });
        
        // Check if it's actually a success that's being reported as error
        if (error instanceof Error && error.message.includes('Memory stored successfully')) {
          // Extract memory ID from error message if possible
          const idMatch = error.message.match(/Memory stored successfully: ([\w-]+)/);
          const memoryId = idMatch ? idMatch[1] : 'unknown';
          
          return {
            content: [
              {
                type: 'text',
                text: `Memory stored successfully: ${memoryId}`,
              },
            ],
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Error storing memory: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register memory retrieval tool
  server.registerTool(
    'getMemory',
    {
      title: 'Get Memory',
      description: 'Retrieve a specific memory by ID',
      inputSchema: {
        memoryId: z.string().describe('Memory ID'),
      },
    },
    async ({ memoryId }) => {
      try {
        const memory = await cmiService.get(userId || 'anonymous', memoryId);
        if (!memory) {
          throw new Error('Memory not found');
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(memory, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP get memory error', { error });
        return {
          content: [
            {
              type: 'text',
              text: `Error retrieving memory: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register list modules tool
  server.registerTool(
    'listModules',
    {
      title: 'List Modules',
      description: 'Get list of all available memory modules',
      inputSchema: {},
    },
    async () => {
      try {
        const modules = await moduleRegistry.listModules();
        const moduleInfo = modules.map(m => ({
          id: m.id,
          name: m.name,
          description: m.description,
          type: m.type,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(moduleInfo, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP list modules error', { error });
        return {
          content: [
            {
              type: 'text',
              text: `Error listing modules: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register module stats tool
  server.registerTool(
    'getModuleStats',
    {
      title: 'Get Module Statistics',
      description: 'Get statistics for a specific module',
      inputSchema: {
        moduleId: z.string().describe('Module ID (required) - one of: technical, personal, work, learning, communication, creative'),
      },
    },
    async ({ moduleId }) => {
      try {
        const module = await moduleRegistry.getModule(moduleId);
        if (!module) {
          throw new Error('Module not found');
        }

        // Get module info since getStatistics is not available in BaseModule
        const moduleInfo = module.getModuleInfo();
        const stats = {
          moduleId: moduleId,
          name: moduleInfo.name,
          description: moduleInfo.description,
          type: moduleInfo.type,
          // TODO: Add actual stats when module implements getStatistics
        };
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP module stats error', { error });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting module stats: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register memory prompt
  server.registerPrompt(
    'searchAndSummarize',
    {
      title: 'Search and Summarize',
      description: 'Search memories and provide a summary',
      argsSchema: {
        topic: z.string().describe('Topic to search for'),
        maxResults: z.number().optional().default(5).describe('Maximum results'),
      },
    },
    async ({ topic, maxResults }) => {
      const results = await cmiService.search(
        userId || 'anonymous',
        topic,
        { limit: maxResults || 5 }
      );

      const summaryText = results
        .map((r: any, i: number) => `${i + 1}. [${r.moduleId}] ${r.content.substring(0, 100)}...`)
        .join('\n');

      return {
        messages: [
          {
            role: 'system',
            content: {
              type: 'text',
              text: 'You are a helpful assistant that summarizes memory search results.',
            },
          },
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please summarize these search results for "${topic}":\n\n${summaryText}`,
            },
          },
        ],
      };
    }
  );

  return server;
}

// Create Express app for MCP server
export function createMcpApp() {
  const app = express();

  // Enable CORS for browser clients
  app.use(cors({
    origin: ['http://localhost:*', 'https://claude.ai', 'https://*.claude.ai'],
    credentials: true,
    exposedHeaders: ['Mcp-Session-Id'],
    allowedHeaders: ['Content-Type', 'Mcp-Session-Id', 'Authorization', 'Last-Event-ID'],
  }));

  app.use(express.json());

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
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          logger.info('MCP session initialized', { sessionId: id });
          transports.set(id, transport);
        },
        enableDnsRebindingProtection: true,
        allowedHosts: ['127.0.0.1', 'localhost', 'localhost:3001', 'localhost:3000'],
      });

      transport.onclose = () => {
        logger.info('MCP session closed', { sessionId: transport.sessionId });
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
        }
      };

      // Extract userId from auth header if available
      const authHeader = req.headers.authorization;
      const userId = extractUserIdFromAuth(authHeader);

      mcpServer = createMcpServer(userId);
      await mcpServer.connect(transport);
    } else {
      // Session required but not provided
      res.status(400).json({
        error: {
          code: -32000,
          message: 'Session ID required for non-initialize requests',
        },
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
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

  return app;
}

// Helper functions
function isInitializeRequest(body: any): boolean {
  return body?.method === 'initialize';
}

function extractUserIdFromAuth(authHeader?: string): string | undefined {
  if (!authHeader) return undefined;

  try {
    // Try to extract from JWT token or API key
    const [type, token] = authHeader.split(' ');
    if (type === 'Bearer' && token) {
      // TODO: Verify JWT and extract userId
      // For now, return undefined
      return undefined;
    }
  } catch (error) {
    logger.error('Failed to extract userId from auth', { error });
  }

  return undefined;
}