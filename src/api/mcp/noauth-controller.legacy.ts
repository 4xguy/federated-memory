import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AuthService } from '@/services/auth.service';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/database';
import { getInitializedCMIService } from '@/index';
import { ModuleRegistry } from '@/core/modules/registry.service';
import { OptimizedQueries } from './query-optimizations';
import { createAuthenticatedMcpServer } from './authenticated-server';
import { getToolsList } from './tools-list';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

const router = Router();
const authService = AuthService.getInstance();

// Store MCP server instances per user
const mcpServers = new Map<string, any>();

// Store HTTP transports for session management
const httpTransports = new Map<string, StreamableHTTPServerTransport>();

// Helper to get or create MCP server for user
function getMcpServerForUser(userId: string, email: string, name?: string) {
  const key = userId;
  
  if (!mcpServers.has(key)) {
    const userContext = {
      userId,
      email,
      name
    };
    
    const server = createAuthenticatedMcpServer(userContext);
    mcpServers.set(key, server);
  }
  
  return mcpServers.get(key);
}

// Get tools list for user
async function getToolsListForUser(userId: string): Promise<any[]> {
  // This function returns the complete list of tools available
  // It's shared between OAuth and token-based authentication
  return getToolsList();
}

// Root handler for token URLs
router.get('/:token', async (req: Request, res: Response) => {
  const token = req.params.token;
  
  // Validate token
  const authResult = await authService.validateToken(token);
  if (!authResult) {
    return res.status(404).json({ error: 'Invalid token' });
  }
  
  // Return info about the token-based MCP endpoint
  // Use BASE_URL if set (for Railway deployments) or construct from request
  const baseUrl = process.env.BASE_URL || 
    `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`;
  
  res.json({
    message: 'Federated Memory MCP Server',
    token: token,
    endpoints: {
      config: `${baseUrl}/${token}/config`,
      mcp: `${baseUrl}/${token}/mcp`, // New Streamable HTTP endpoint
      sse: `${baseUrl}/${token}/sse`, // Legacy SSE endpoint (deprecated)
      messages: `${baseUrl}/${token}/messages/:sessionId`, // Legacy messages endpoint (deprecated)
    },
    usage: 'Use this URL in Claude Desktop or any MCP-compatible client',
    note: 'SSE endpoints are deprecated. Please use the /mcp endpoint with Streamable HTTP transport.',
  });
});

// Config endpoint for token-based URLs (BigMemory pattern)
router.get('/:token/config', async (req: Request, res: Response) => {
  const token = req.params.token;
  
  // Validate token
  const authResult = await authService.validateToken(token);
  if (!authResult) {
    return res.status(404).json({ error: 'Invalid token' });
  }
  
  // Check if client wants SSE transport (for backwards compatibility)
  const userAgent = req.headers['user-agent'] || '';
  const prefersSse = req.query.transport === 'sse' || 
                     req.headers['x-mcp-transport'] === 'sse';
  
  // Use BASE_URL if set (for Railway deployments) or construct from request
  const baseUrl = process.env.BASE_URL || 
    `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`;
  
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
      transport: prefersSse ? {
        type: 'sse',
        endpoint: `${baseUrl}/${token}/sse`,
      } : {
        type: 'streamable-http',
        endpoint: `${baseUrl}/${token}/mcp`,
      },
      // No auth section - authentication is via token in URL
    },
  });
});

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
      // Try to ensure registries exist, but don't fail if service isn't ready
      try {
        const cmiService = getInitializedCMIService();
        if (cmiService) {
          await ensureRegistries(cmiService, sseConnection.userId);
        }
      } catch (error) {
        logger.warn('Failed to ensure registries during tools/list', { error });
        // Continue without registries - tools can still be listed
      }
      
      // Get user details for MCP server
      const user = await prisma.user.findUnique({
        where: { id: sseConnection.userId },
        select: { email: true, name: true }
      });
      
      // Get MCP server for this user
      const mcpServer = getMcpServerForUser(
        sseConnection.userId,
        user?.email || 'unknown@example.com',
        user?.name || undefined
      );
      
      // Instead of hardcoding tools, we'll maintain a list that's shared with authenticated-server
      // This ensures both OAuth and token users get the same tools
      const tools = await getToolsListForUser(sseConnection.userId);
      
      response = {
        jsonrpc: '2.0',
        result: {
          tools
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
        
        // Get user details for MCP server
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true }
        });
        
        // Get MCP server for this user
        const mcpServer = getMcpServerForUser(
          userId,
          user?.email || 'unknown@example.com',
          user?.name || undefined
        );
        
        // The MCP server has all tools registered, but we need to handle the call differently
        // Since the SDK doesn't expose a direct callTool method, we'll implement the tool execution
        // using the same pattern as before but with better organization
        
        // Import tool handlers
        const { executeToolForUser } = await import('./tool-executor');
        const result = await executeToolForUser(name, args, userId);
        
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
    } else if (method === 'DEPRECATED_tools/call') {
      // Keep old implementation as fallback temporarily
      const { name, arguments: args } = params;
      
      try {
        const userId = sseConnection.userId;
        let result: any;
        
        if (name === 'searchMemory') {
          // Search across federated modules
          const cmiService = getInitializedCMIService();
          const searchResults = await cmiService.search(userId, args.query, {
            limit: args.limit || 10,
            modules: args.modules
          });
          
          // Ensure searchResults is an array
          const results = Array.isArray(searchResults) ? searchResults : [];
          
          result = {
            results: results.map((r: any) => ({
              content: r.content || r.summary || '',
              moduleId: r.moduleId,
              similarity: r.similarity || r.score || 0,
              metadata: r.metadata || {},
              timestamp: r.timestamp || r.createdAt || new Date().toISOString()
            })),
            query: args.query,
            count: results.length,
            message: results.length > 0 
              ? `Found ${results.length} memories`
              : 'No memories found matching your query'
          };
        } else if (name === 'storeMemory') {
          // Store in appropriate module via CMI
          const cmiService = getInitializedCMIService();
          
          // Ensure content is a string
          const content = typeof args.content === 'string' 
            ? args.content 
            : JSON.stringify(args.content);
          
          const memoryId = await cmiService.store(
            userId, 
            content,
            { ...args.metadata, source: 'mcp' },
            undefined // Let CMI determine the module
          );
          
          result = {
            success: true,
            message: 'Memory stored successfully',
            memoryId: memoryId,
            moduleId: 'auto-determined' // CMI determines the module
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
        } else if (name === 'getMemory') {
          // Get a specific memory
          const cmiService = getInitializedCMIService();
          const memory = await cmiService.get(userId, args.memoryId);
          
          if (!memory) {
            response = {
              jsonrpc: '2.0',
              error: {
                code: -32602,
                message: 'Memory not found'
              },
              id
            };
          } else {
            result = {
              memory: memory,
              message: 'Memory retrieved successfully'
            };
          }
        } else if (name === 'updateMemory') {
          // Update an existing memory
          const cmiService = getInitializedCMIService();
          
          // First get the memory to find its module
          const existingMemory = await cmiService.get(userId, args.memoryId);
          if (!existingMemory) {
            response = {
              jsonrpc: '2.0',
              error: {
                code: -32602,
                message: 'Memory not found'
              },
              id
            };
          } else {
            // Update through the module
            const moduleRegistry = ModuleRegistry.getInstance();
            const module = await moduleRegistry.getModule(existingMemory.moduleId);
            if (module) {
              const updates: any = {};
              if (args.content !== undefined) updates.content = args.content;
              if (args.metadata !== undefined) updates.metadata = args.metadata;
              
              const success = await module.update(userId, args.memoryId, updates);
              result = {
                success: success,
                message: success ? 'Memory updated successfully' : 'Failed to update memory',
                memoryId: args.memoryId
              };
            } else {
              response = {
                jsonrpc: '2.0',
                error: {
                  code: -32603,
                  message: 'Module not found'
                },
                id
              };
            }
          }
        } else if (name === 'removeMemory') {
          // Remove a memory
          const cmiService = getInitializedCMIService();
          
          // First get the memory to find its module
          const existingMemory = await cmiService.get(userId, args.memoryId);
          if (!existingMemory) {
            response = {
              jsonrpc: '2.0',
              error: {
                code: -32602,
                message: 'Memory not found'
              },
              id
            };
          } else {
            // Delete through the module
            const moduleRegistry = ModuleRegistry.getInstance();
            const module = await moduleRegistry.getModule(existingMemory.moduleId);
            if (module) {
              const success = await module.delete(userId, args.memoryId);
              result = {
                success: success,
                message: success ? 'Memory removed successfully' : 'Failed to remove memory',
                memoryId: args.memoryId
              };
            } else {
              response = {
                jsonrpc: '2.0',
                error: {
                  code: -32603,
                  message: 'Module not found'
                },
                id
              };
            }
          }
        } else if (name === 'searchCategories') {
          // Use efficient database function to get categories with counts
          try {
            // First check if the function exists
            const functionExists = await prisma.$queryRaw<Array<{exists: boolean}>>`
              SELECT EXISTS (
                SELECT 1 FROM pg_proc 
                WHERE proname = 'get_category_registry_with_counts'
              ) as exists
            `;
            
            if (!functionExists[0]?.exists) {
              throw new Error('Database function not yet created');
            }
            
            // Query the database directly for category counts
            const categoryData = await prisma.$queryRaw<Array<{
              category_name: string;
              description: string | null;
              icon: string | null;
              parent_category: string | null;
              memory_count: bigint;
            }>>`
              SELECT * FROM get_category_registry_with_counts(${userId})
            `;
            
            // Convert bigint to number and format results
            let categories = categoryData.map(cat => ({
              name: cat.category_name,
              description: cat.description,
              icon: cat.icon,
              parentCategory: cat.parent_category,
              memoryCount: Number(cat.memory_count)
            }));
            
            // Apply search filter if provided
            if (args.query && typeof args.query === 'string') {
              const query = args.query.toLowerCase();
              categories = categories.filter(cat => 
                cat.name.toLowerCase().includes(query) ||
                (cat.description && cat.description.toLowerCase().includes(query))
              );
            }
            
            result = {
              categories: categories,
              count: categories.length,
              message: categories.length > 0 ? `Found ${categories.length} categories` : 'No categories found'
            };
          } catch (dbError) {
            // Fallback if database function doesn't exist yet
            logger.warn('Category count function not available, using fallback', { error: dbError });
            
            // Simple fallback - just return categories without counts
            const cmiService = getInitializedCMIService();
            const registrySearch = await OptimizedQueries.getRegistry(
              userId,
              'categories',
              'personal'
            );
            
            let categories = [];
            if (registrySearch && registrySearch.metadata?.items) {
              // Registry stores categories in 'items' field
              categories = registrySearch.metadata.items.map((cat: any) => ({
                ...cat,
                memoryCount: 0
              }));
            } else {
              // If no registry found, use CMI fallback to search for categories
              const categoryMemories = await prisma.$queryRaw<any[]>`
                SELECT DISTINCT metadata->>'category' as category_name
                FROM personal_memories
                WHERE "userId" = ${userId}
                  AND metadata->>'category' IS NOT NULL
                UNION
                SELECT DISTINCT metadata->>'category' as category_name
                FROM work_memories
                WHERE "userId" = ${userId}
                  AND metadata->>'category' IS NOT NULL
                UNION
                SELECT DISTINCT metadata->>'category' as category_name
                FROM technical_memories
                WHERE "userId" = ${userId}
                  AND metadata->>'category' IS NOT NULL
                LIMIT 50
              `;
              
              categories = categoryMemories.map(c => ({
                name: c.category_name,
                description: null,
                icon: null,
                parentCategory: null,
                memoryCount: 0
              }));
            }
            
            result = {
              categories: categories,
              count: categories.length,
              message: 'Category counts unavailable - database migration pending'
            };
          }
        } else if (name === 'createCategory') {
          // Create or update category in the registry
          const cmiService = getInitializedCMIService();
          const categoryId = randomUUID();
          
          // First, get or create the category registry
          const registrySearch = await OptimizedQueries.getRegistry(
            userId,
            'categories',
            'personal'
          );
          
          let registryMemory;
          let categories = [];
          
          if (registrySearch) {
            registryMemory = registrySearch;
            categories = registryMemory.metadata?.categories || [];
          }
          
          // Check if category already exists
          const existingIndex = categories.findIndex((cat: any) => cat.name === args.name);
          
          const newCategory = {
            id: categoryId,
            name: args.name,
            description: args.description,
            icon: args.icon,
            parentCategory: args.parentCategory,
            createdAt: new Date().toISOString()
          };
          
          if (existingIndex >= 0) {
            // Update existing category
            categories[existingIndex] = { ...categories[existingIndex], ...newCategory };
          } else {
            // Add new category
            categories.push(newCategory);
          }
          
          // Update or create the registry
          if (registryMemory) {
            // Update existing registry
            await cmiService.update(
              userId,
              registryMemory.id,
              {
                metadata: {
                  ...registryMemory.metadata,
                  categories: categories,
                  updatedAt: new Date().toISOString()
                }
              }
            );
          } else {
            // Create new registry
            await cmiService.store(
              userId,
              'Category Registry\nThis memory maintains the list of all categories in the system.',
              {
                type: 'list',
                name: 'category_registry',
                category: 'system',
                categories: categories,
                createdAt: new Date().toISOString()
              },
              'personal'
            );
          }
          
          result = {
            success: true,
            message: existingIndex >= 0 ? 'Category updated successfully' : 'Category created successfully',
            category: newCategory
          };
        } else if (name === 'createProject') {
          // Create a new project as a memory with project metadata
          const cmiService = getInitializedCMIService();
          const projectId = randomUUID();
          
          const projectData = {
            id: projectId,
            name: args.name,
            description: args.description,
            status: args.status || 'planning',
            dueDate: args.dueDate,
            startDate: args.startDate,
            owner: args.owner,
            team: args.team || [],
            ministry: args.ministry,
            type: 'project'
          };
          
          const content = `Project: ${args.name}\n${args.description || ''}`;
          const memoryId = await cmiService.store(
            userId,
            content,
            {
              ...projectData,
              category: 'project_management'
            },
            'work' // Store in work module
          );
          
          result = {
            success: true,
            message: 'Project created successfully',
            project: projectData,
            memoryId: memoryId
          };
        } else if (name === 'listProjects') {
          // Use optimized SQL query for listing projects
          const projectsWithCounts = await OptimizedQueries.listProjects(
            userId, 
            args.includeCompleted || false
          );
          
          // Apply additional filters if provided
          let filteredProjects = projectsWithCounts.filter((project: any) => {
            const metadata = project.metadata || {};
            
            // Apply filters
            if (args.status && metadata.status !== args.status) return false;
            if (args.owner && metadata.owner !== args.owner) return false;
            if (args.ministry && metadata.ministry !== args.ministry) return false;
            
            return true;
          });
          
          // Format the response
          const formattedProjects = filteredProjects.map((project: any) => ({
            id: project.metadata.id || project.id,
            name: project.metadata.name,
            description: project.metadata.description,
            status: project.metadata.status,
            dueDate: project.metadata.dueDate,
            owner: project.metadata.owner,
            team: project.metadata.team || [],
            ministry: project.metadata.ministry,
            taskCount: project.taskCount,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
          }));
          
          result = {
            projects: formattedProjects,
            count: formattedProjects.length
          };
        } else if (name === 'getProjectTasks') {
          // Use optimized SQL query for getting project tasks
          const taskMemories = await OptimizedQueries.getProjectTasks(userId, args.projectId);
          
          const tasks = (taskMemories as any[]).map((memory: any) => ({
            id: memory.metadata.id || memory.id,
            title: memory.metadata.title,
            description: memory.metadata.description,
            projectId: memory.metadata.projectId,
            assignee: memory.metadata.assignee,
            priority: memory.metadata.priority || 'medium',
            status: memory.metadata.status || 'todo',
            dueDate: memory.metadata.dueDate,
            estimatedHours: memory.metadata.estimatedHours,
            completedAt: memory.metadata.completedAt,
            ministry: memory.metadata.ministry,
            createdAt: memory.createdAt,
            updatedAt: memory.updatedAt
          }));
          
          result = {
            tasks: tasks,
            count: tasks.length,
            projectId: args.projectId
          };
        } else if (name === 'createTask') {
          // Create a new task as a memory with task metadata
          const cmiService = getInitializedCMIService();
          const taskId = randomUUID();
          
          const taskData = {
            id: taskId,
            title: args.title,
            description: args.description,
            projectId: args.projectId,
            assignee: args.assignee,
            priority: args.priority || 'medium',
            status: args.status || 'todo',
            dueDate: args.dueDate,
            estimatedHours: args.estimatedHours,
            ministry: args.ministry,
            type: 'task'
          };
          
          const content = `Task: ${args.title}\n${args.description || ''}\nProject: ${args.projectId || 'None'}`;
          const memoryId = await cmiService.store(
            userId,
            content,
            {
              ...taskData,
              category: 'project_management'
            },
            'work' // Store in work module
          );
          
          result = {
            success: true,
            message: 'Task created successfully',
            task: taskData,
            memoryId: memoryId
          };
        } else if (name === 'updateTaskStatus') {
          // Update task status by finding and updating the memory
          const cmiService = getInitializedCMIService();
          
          // First try to find the task by the provided ID (could be memory ID)
          let taskMemory = await cmiService.get(userId, args.taskId);
          
          // If not found directly, search using raw SQL to find by metadata.id
          if (!taskMemory) {
            const workMemories = await prisma.$queryRaw<any[]>`
              SELECT id, "userId", content, metadata, "createdAt", "updatedAt"
              FROM work_memories
              WHERE "userId" = ${userId}
                AND metadata->>'type' = 'task'
                AND (metadata->>'id' = ${args.taskId} OR id = ${args.taskId})
              LIMIT 1
            `;
            
            if (workMemories.length > 0) {
              taskMemory = {
                id: workMemories[0].id,
                userId: workMemories[0].userId,
                content: workMemories[0].content,
                metadata: workMemories[0].metadata,
                createdAt: workMemories[0].createdAt,
                updatedAt: workMemories[0].updatedAt,
                moduleId: 'work'
              };
            }
          }
          
          if (!taskMemory || taskMemory.metadata?.type !== 'task') {
            response = {
              jsonrpc: '2.0',
              error: {
                code: -32602,
                message: `Task not found with ID: ${args.taskId}`
              },
              id
            };
          } else {
            // Update the task metadata
            const updatedMetadata = {
              ...taskMemory.metadata,
              status: args.status,
              completedAt: args.status === 'done' ? new Date().toISOString() : taskMemory.metadata.completedAt
            };
            
            // Use the actual memory ID for the update
            const memoryId = taskMemory.id || args.taskId;
            const success = await cmiService.update(
              userId,
              memoryId,
              { metadata: updatedMetadata }
            );
            
            result = {
              success: success,
              message: success ? 'Task status updated successfully' : 'Failed to update task status',
              task: {
                id: taskMemory.metadata.id || memoryId,
                title: taskMemory.metadata.title,
                status: args.status,
                completedAt: updatedMetadata.completedAt
              }
            };
          }
        } else if (name === 'linkTaskDependency') {
          // Create task dependency as a memory
          const cmiService = getInitializedCMIService();
          const dependencyId = randomUUID();
          
          const dependencyData = {
            id: dependencyId,
            taskId: args.taskId,
            dependsOnTaskId: args.dependsOnTaskId,
            dependencyType: args.dependencyType || 'depends_on',
            type: 'task_dependency'
          };
          
          const content = `Task Dependency: ${args.taskId} ${args.dependencyType || 'depends_on'} ${args.dependsOnTaskId}`;
          const memoryId = await cmiService.store(
            userId,
            content,
            {
              ...dependencyData,
              category: 'project_management'
            },
            'work'
          );
          
          result = {
            success: true,
            message: 'Task dependency created successfully',
            dependency: dependencyData,
            memoryId: memoryId
          };
        } else if (name === 'listTasks') {
          // Use optimized SQL query for listing tasks
          const taskMemories = await OptimizedQueries.listTasks(userId, {
            projectId: args.projectId,
            status: args.status,
            assignee: args.assignee,
            includeCompleted: args.includeCompleted
          });
          
          // Get project names if needed using batch query
          const projectIds = [...new Set((taskMemories as any[])
            .map((t: any) => t.metadata.projectId)
            .filter(Boolean))];
          
          const projectMap = new Map();
          if (projectIds.length > 0) {
            const projects = await prisma.$queryRaw<any[]>`
              SELECT id, metadata
              FROM work_memories
              WHERE "userId" = ${userId}
                AND metadata->>'type' = 'project'
                AND (id = ANY(${projectIds}) OR metadata->>'id' = ANY(${projectIds}))
            `;
            
            projects.forEach(p => {
              projectMap.set(p.id, p.metadata.name);
              if (p.metadata.id) {
                projectMap.set(p.metadata.id, p.metadata.name);
              }
            });
          }
          
          // Format tasks with project names
          const tasksWithDetails = (taskMemories as any[]).map((memory: any) => {
            const projectName = memory.metadata.projectId 
              ? projectMap.get(memory.metadata.projectId) || null
              : null;
              
            return {
              id: memory.metadata.id || memory.id,
              title: memory.metadata.title,
                description: memory.metadata.description,
                projectId: memory.metadata.projectId,
                projectName: projectName,
                assignee: memory.metadata.assignee,
                priority: memory.metadata.priority || 'medium',
                status: memory.metadata.status || 'todo',
                dueDate: memory.metadata.dueDate,
                estimatedHours: memory.metadata.estimatedHours,
                completedAt: memory.metadata.completedAt,
                ministry: memory.metadata.ministry,
                createdAt: memory.createdAt,
                updatedAt: memory.updatedAt
              };
            });
          
          result = {
            tasks: tasksWithDetails,
            count: tasksWithDetails.length
          };
        } else if (name === 'getTaskDependencies') {
          // Get dependencies for a task using raw SQL query
          const cmiService = getInitializedCMIService();
          
          // Search for dependencies where this task is involved using SQL
          const dependencyMemories = await prisma.$queryRaw<any[]>`
            SELECT id, "userId", content, metadata, "createdAt", "updatedAt"
            FROM work_memories
            WHERE "userId" = ${userId}
              AND metadata->>'type' = 'task_dependency'
              AND (metadata->>'taskId' = ${args.taskId} 
                   OR metadata->>'dependsOnTaskId' = ${args.taskId})
          `;
          
          // Convert to standard format
          const relevantDeps = dependencyMemories.map(mem => ({
            id: mem.id,
            userId: mem.userId,
            content: mem.content,
            metadata: mem.metadata,
            createdAt: mem.createdAt,
            updatedAt: mem.updatedAt
          }));
          
          // Get task details for dependencies
          const dependencies = [];
          const dependents = [];
          
          for (const dep of relevantDeps) {
            if (dep.metadata.taskId === args.taskId) {
              // This is a dependency - find the task it depends on
              const [dependsOnTask] = await prisma.$queryRaw<any[]>`
                SELECT id, metadata
                FROM work_memories
                WHERE "userId" = ${userId}
                  AND metadata->>'type' = 'task'
                  AND (metadata->>'id' = ${dep.metadata.dependsOnTaskId} 
                       OR id = ${dep.metadata.dependsOnTaskId})
                LIMIT 1
              `;
              
              if (dependsOnTask) {
                dependencies.push({
                  id: dep.metadata.id || dep.id,
                  dependsOnTaskId: dep.metadata.dependsOnTaskId,
                  dependsOnTaskTitle: dependsOnTask.metadata.title,
                  dependsOnTaskStatus: dependsOnTask.metadata.status,
                  dependencyType: dep.metadata.dependencyType
                });
              }
            } else if (dep.metadata.dependsOnTaskId === args.taskId) {
              // This is a dependent - find the task that depends on this one
              const [task] = await prisma.$queryRaw<any[]>`
                SELECT id, metadata
                FROM work_memories
                WHERE "userId" = ${userId}
                  AND metadata->>'type' = 'task'
                  AND (metadata->>'id' = ${dep.metadata.taskId} 
                       OR id = ${dep.metadata.taskId})
                LIMIT 1
              `;
              
              if (task) {
                dependents.push({
                  id: dep.metadata.id || dep.id,
                  taskId: dep.metadata.taskId,
                  taskTitle: task.metadata.title,
                  taskStatus: task.metadata.status,
                  dependencyType: dep.metadata.dependencyType
                });
              }
            }
          }
          
          result = {
            dependencies: dependencies,
            dependents: dependents,
            taskId: args.taskId
          };
        } else if (name === 'createRecurringTask') {
          // Create a recurring task template as a memory
          const cmiService = getInitializedCMIService();
          const recurringTaskId = randomUUID();
          const nextDue = calculateNextDue(args.recurrence);
          
          const recurringTaskData = {
            id: recurringTaskId,
            title: args.title,
            description: args.description,
            recurrence: args.recurrence,
            assignee: args.assignee,
            projectId: args.projectId,
            priority: args.priority || 'medium',
            ministry: args.ministry,
            nextDue: nextDue.toISOString(),
            isActive: true,
            type: 'recurring_task'
          };
          
          const content = `Recurring Task: ${args.title}\n${args.description || ''}\nRecurrence: ${JSON.stringify(args.recurrence)}`;
          const memoryId = await cmiService.store(
            userId,
            content,
            {
              ...recurringTaskData,
              category: 'project_management'
            },
            'work'
          );
          
          // Create the first task instance
          const firstTaskId = randomUUID();
          const firstTaskData = {
            id: firstTaskId,
            title: args.title,
            description: args.description,
            projectId: args.projectId,
            assignee: args.assignee,
            priority: args.priority || 'medium',
            status: 'todo',
            dueDate: nextDue.toISOString(),
            recurringTaskId: recurringTaskId,
            ministry: args.ministry,
            type: 'task'
          };
          
          const firstTaskContent = `Task: ${args.title}\n${args.description || ''}\nDue: ${nextDue.toISOString()}\n(From recurring task)`;
          const firstTaskMemoryId = await cmiService.store(
            userId,
            firstTaskContent,
            {
              ...firstTaskData,
              category: 'project_management'
            },
            'work'
          );
          
          result = {
            success: true,
            message: 'Recurring task created successfully',
            recurringTask: {
              id: recurringTaskId,
              title: args.title,
              description: args.description,
              recurrence: args.recurrence,
              nextDue: nextDue.toISOString()
            },
            firstTask: {
              id: firstTaskId,
              title: args.title,
              dueDate: nextDue.toISOString()
            },
            memoryIds: {
              recurringTask: memoryId,
              firstTask: firstTaskMemoryId
            }
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

/**
 * Streamable HTTP endpoint with token in URL
 * POST /:token/mcp
 * Handles all MCP requests via Streamable HTTP transport
 */
router.post('/:token/mcp', async (req: Request, res: Response) => {
  const token = req.params.token;
  const sessionId = req.headers['mcp-session-id'] as string;
  
  try {
    // Validate token
    const authResult = await authService.validateToken(token);
    if (!authResult) {
      return res.status(404).end(); // Don't leak token validity
    }
    
    const userId = authResult.userId;
    let transport: StreamableHTTPServerTransport;
    let mcpServer: any;
    
    // Check for existing session
    if (sessionId && httpTransports.has(sessionId)) {
      transport = httpTransports.get(sessionId)!;
      logger.debug('Reusing existing HTTP transport', { sessionId, token: token.substring(0, 8) + '...' });
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // Create new session
      const newSessionId = randomUUID();
      logger.info('Creating new HTTP session', { 
        sessionId: newSessionId,
        token: token.substring(0, 8) + '...',
        method: req.body?.method 
      });
      
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        onsessioninitialized: (id: string) => {
          logger.info('HTTP session initialized', { sessionId: id });
          httpTransports.set(id, transport);
        },
        enableDnsRebindingProtection: false, // Disable for compatibility
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
        logger.info('HTTP session closed', { sessionId: transport.sessionId });
        if (transport.sessionId) {
          httpTransports.delete(transport.sessionId);
        }
      };
      
      // Get user details for MCP server
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true }
      });
      
      // Create MCP server with user context
      mcpServer = getMcpServerForUser(
        userId,
        user?.email || 'unknown@example.com',
        user?.name || undefined
      );
      
      await mcpServer.connect(transport);
      logger.info('MCP server connected via HTTP', { 
        sessionId: newSessionId,
        userId 
      });
    } else {
      // Session required but not provided
      logger.warn('HTTP request without session ID', { 
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
    
    // Handle the request
    await transport.handleRequest(req, res, req.body);
    
  } catch (error) {
    logger.error('Error handling HTTP MCP request', { 
      error, 
      token: token.substring(0, 8) + '...',
      sessionId 
    });
    
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          code: -32603,
          message: 'Internal server error',
        },
      });
    }
  }
});

/**
 * Streamable HTTP GET endpoint for server-sent events
 * GET /:token/mcp
 */
router.get('/:token/mcp', async (req: Request, res: Response) => {
  const token = req.params.token;
  const sessionId = req.headers['mcp-session-id'] as string;
  
  try {
    // Validate token
    const authResult = await authService.validateToken(token);
    if (!authResult) {
      return res.status(404).end();
    }
    
    if (!sessionId || !httpTransports.has(sessionId)) {
      res.status(400).json({
        error: {
          code: -32000,
          message: 'Invalid or missing session ID',
        },
      });
      return;
    }
    
    const transport = httpTransports.get(sessionId)!;
    await transport.handleRequest(req, res);
    
  } catch (error) {
    logger.error('Error handling HTTP GET request', { 
      error, 
      token: token.substring(0, 8) + '...',
      sessionId 
    });
    
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          code: -32603,
          message: 'Internal server error',
        },
      });
    }
  }
});

/**
 * Streamable HTTP DELETE endpoint for session termination
 * DELETE /:token/mcp
 */
router.delete('/:token/mcp', async (req: Request, res: Response) => {
  const token = req.params.token;
  const sessionId = req.headers['mcp-session-id'] as string;
  
  try {
    // Validate token
    const authResult = await authService.validateToken(token);
    if (!authResult) {
      return res.status(404).end();
    }
    
    if (!sessionId || !httpTransports.has(sessionId)) {
      res.status(404).json({
        error: {
          code: -32000,
          message: 'Session not found',
        },
      });
      return;
    }
    
    const transport = httpTransports.get(sessionId)!;
    await transport.close();
    httpTransports.delete(sessionId);
    
    res.status(204).send();
    
  } catch (error) {
    logger.error('Error handling HTTP DELETE request', { 
      error, 
      token: token.substring(0, 8) + '...',
      sessionId 
    });
    
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          code: -32603,
          message: 'Internal server error',
        },
      });
    }
  }
});

// CORS preflight handler for HTTP endpoint
router.options('/:token/mcp', (_req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id, Last-Event-ID');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  res.sendStatus(200);
});

// Health check endpoint for HTTP transport
router.get('/:token/mcp/health', async (req: Request, res: Response) => {
  const token = req.params.token;
  
  try {
    // Validate token
    const authResult = await authService.validateToken(token);
    if (!authResult) {
      return res.status(404).end();
    }
    
    // Set CORS headers for MCP Inspector
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    res.json({
      status: 'healthy',
      transport: 'streamable-http',
      protocol: '2025-03-26',
      authenticated: true,
      userId: authResult.userId,
      capabilities: {
        tools: true,
        resources: false,
        prompts: true,
        sampling: false,
      },
      activeSessions: httpTransports.size,
    });
  } catch (error) {
    logger.error('Health check failed', { error, token: token.substring(0, 8) + '...' });
    res.status(503).json({
      status: 'unhealthy',
      error: 'Service error',
    });
  }
});

// Simple info endpoint is already defined above

// Helper function to ensure registry memories exist
async function ensureRegistries(cmiService: any, userId: string) {
  // Check for category registry
  const categoryRegistry = await cmiService.search(
    userId,
    'type:list name:category_registry',
    { moduleId: 'personal', limit: 1 }
  );
  
  if (categoryRegistry.length === 0) {
    // Create default category registry with common categories
    await cmiService.store(
      userId,
      'Category Registry\nThis memory maintains the list of all categories in the system.',
      {
        type: 'list',
        name: 'category_registry',
        category: 'system',
        categories: [
          { id: randomUUID(), name: 'Personal', description: 'Personal memories and notes', icon: '👤' },
          { id: randomUUID(), name: 'Work', description: 'Work-related memories', icon: '💼' },
          { id: randomUUID(), name: 'Learning', description: 'Learning and education', icon: '📚' },
          { id: randomUUID(), name: 'Technical', description: 'Technical documentation and code', icon: '💻' },
          { id: randomUUID(), name: 'Ideas', description: 'Creative ideas and brainstorming', icon: '💡' },
          { id: randomUUID(), name: 'References', description: 'Reference materials and links', icon: '🔗' },
          { id: randomUUID(), name: 'project_management', description: 'Projects and tasks', icon: '📋' },
          { id: randomUUID(), name: 'system', description: 'System and configuration', icon: '⚙️' }
        ],
        createdAt: new Date().toISOString()
      },
      'personal'
    );
  }
  
  // Check for type registry
  const typeRegistry = await cmiService.search(
    userId,
    'type:list name:type_registry',
    { moduleId: 'personal', limit: 1 }
  );
  
  if (typeRegistry.length === 0) {
    // Create default type registry
    await cmiService.store(
      userId,
      'Type Registry\nThis memory maintains the list of all memory types in the system.',
      {
        type: 'list',
        name: 'type_registry',
        category: 'system',
        types: [
          { name: 'note', description: 'General notes and thoughts' },
          { name: 'project', description: 'Project definitions' },
          { name: 'task', description: 'Tasks and to-dos' },
          { name: 'task_dependency', description: 'Task relationships' },
          { name: 'recurring_task', description: 'Recurring task templates' },
          { name: 'list', description: 'List or registry of items' },
          { name: 'reference', description: 'External references and links' },
          { name: 'code_snippet', description: 'Code examples and snippets' },
          { name: 'configuration', description: 'System configuration' }
        ],
        createdAt: new Date().toISOString()
      },
      'personal'
    );
  }
}

// Helper function to calculate next due date for recurring tasks
function calculateNextDue(recurrence: any): Date {
  const now = new Date();
  const { pattern, interval = 1, daysOfWeek, dayOfMonth } = recurrence;
  
  switch (pattern) {
    case 'daily':
      return new Date(now.getTime() + (interval * 24 * 60 * 60 * 1000));
      
    case 'weekly':
      if (daysOfWeek && daysOfWeek.length > 0) {
        const weekDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDay = now.getDay();
        
        // Find next occurrence
        for (let i = 1; i <= 7; i++) {
          const checkDay = (currentDay + i) % 7;
          const dayName = weekDays[checkDay];
          if (daysOfWeek.includes(dayName)) {
            const nextDate = new Date(now);
            nextDate.setDate(now.getDate() + i);
            return nextDate;
          }
        }
      }
      // Default to next week same day
      return new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
      
    case 'monthly':
      const nextMonth = new Date(now);
      nextMonth.setMonth(now.getMonth() + interval);
      if (dayOfMonth) {
        nextMonth.setDate(Math.min(dayOfMonth, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()));
      }
      return nextMonth;
      
    default:
      // Default to tomorrow
      return new Date(now.getTime() + (24 * 60 * 60 * 1000));
  }
}

export default router;