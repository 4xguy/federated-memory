import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { completable } from '@modelcontextprotocol/sdk/server/completable.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '@/utils/logger';
import { getCMIService } from '../../core/cmi/index.service';
import { ModuleRegistry } from '../../core/modules/registry.service';

interface UserContext {
  userId: string;
  email: string;
  name?: string;
  permissions?: string[];
}

/**
 * Creates an authenticated MCP server with user context
 * This follows the pattern from remote-mcp-server-with-auth where
 * authentication is handled at the transport level and user context
 * is passed through to tool registration
 */
export function createAuthenticatedMcpServer(userContext?: UserContext) {
  const server = new McpServer({
    name: 'federated-memory',
    version: '1.0.0',
  });

  // Get service instances
  const cmiService = getCMIService();
  const moduleRegistry = ModuleRegistry.getInstance();

  // Always register public tools
  registerPublicTools(server, moduleRegistry);

  // Register authenticated tools - they will throw OAuth errors if no context
  registerAuthenticatedTools(server, cmiService, moduleRegistry, userContext);
  
  return server;
}

/**
 * Throws an OAuth authentication error for unauthenticated access
 */
function throwAuthRequired(): never {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  throw new McpError(
    -32001,
    'Authentication required',
    {
      type: 'oauth_required',
      error: 'unauthorized',
      error_description: 'This operation requires authentication. Please authenticate via OAuth.',
      resource_server: baseUrl,
      resource_metadata: `${baseUrl}/.well-known/oauth-protected-resource`,
      www_authenticate: `Bearer realm="${baseUrl}", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
    }
  );
}

/**
 * Register tools that don't require authentication
 */
function registerPublicTools(server: McpServer, moduleRegistry: ModuleRegistry) {
  // List modules tool - public access
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
    },
  );

  // Module stats tool - public access
  server.registerTool(
    'getModuleStats',
    {
      title: 'Get Module Statistics',
      description: 'Get statistics for a specific module',
      inputSchema: {
        moduleId: z
          .string()
          .describe(
            'Module ID (required) - one of: technical, personal, work, learning, communication, creative',
          ),
      },
    },
    async ({ moduleId }) => {
      try {
        const module = await moduleRegistry.getModule(moduleId);
        if (!module) {
          throw new Error('Module not found');
        }

        const moduleInfo = module.getModuleInfo();
        const stats = {
          moduleId: moduleId,
          name: moduleInfo.name,
          description: moduleInfo.description,
          type: moduleInfo.type,
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
    },
  );
}

/**
 * Register tools that require authentication
 */
function registerAuthenticatedTools(
  server: McpServer, 
  cmiService: any, 
  moduleRegistry: ModuleRegistry,
  userContext?: UserContext
) {
  
  // Memory search tool
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
      // Check authentication
      if (!userContext) {
        throwAuthRequired();
      }
      
      try {
        const results = await cmiService.search(userContext!.userId, query, { limit, moduleId });

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
        logger.error('MCP search error', { error, userId: userContext?.userId });
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
    },
  );

  // Memory storage tool
  server.registerTool(
    'storeMemory',
    {
      title: 'Store Memory',
      description: 'Store a new memory in the appropriate module',
      inputSchema: {
        content: z.string().describe('Memory content'),
        metadata: z.record(z.any()).optional().describe('Memory metadata'),
        moduleId: completable(z.string().optional(), async value => {
          const modules = await moduleRegistry.listModules();
          return modules.map(m => m.id).filter(id => id.startsWith(value || ''));
        }).describe('Target module (auto-routed if not specified)'),
      },
    },
    async ({ content, metadata, moduleId }) => {
      // Check authentication
      if (!userContext) {
        throwAuthRequired();
      }
      
      try {
        const memoryId = await cmiService.store(userContext!.userId, content, metadata, moduleId);

        return {
          content: [
            {
              type: 'text',
              text: `Memory stored successfully: ${memoryId}`,
            },
          ],
        };
      } catch (error) {
        logger.error('MCP store error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Failed to store memory: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Memory retrieval tool
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
      // Check authentication
      if (!userContext) {
        throwAuthRequired();
      }
      
      try {
        const memory = await cmiService.get(userContext!.userId, memoryId);
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
        logger.error('MCP get memory error', { error, userId: userContext?.userId });
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
    },
  );

  // Register memory prompt
  server.registerPrompt(
    'searchAndSummarize',
    {
      title: 'Search and Summarize',
      description: 'Search memories and provide a summary',
      argsSchema: {
        topic: z.string().describe('Topic to search for'),
        maxResults: z.string().optional().describe('Maximum results (default: 5)'),
      },
    },
    async ({ topic, maxResults }) => {
      // Check authentication
      if (!userContext) {
        throwAuthRequired();
      }
      const limit = parseInt(maxResults || '5', 10);
      const results = await cmiService.search(userContext!.userId, topic || '', { limit });

      const summaryText = results
        .map((r: any, i: number) => `${i + 1}. [${r.moduleId}] ${r.content.substring(0, 100)}...`)
        .join('\n');

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Please summarize these search results for "${topic}":\n\n${summaryText}`,
            },
          },
        ],
      };
    },
  );
}