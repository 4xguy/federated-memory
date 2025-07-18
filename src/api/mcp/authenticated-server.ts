import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { completable } from '@modelcontextprotocol/sdk/server/completable.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '@/utils/logger';
import { getCMIService } from '../../core/cmi/index.service';
import { ModuleRegistry } from '../../core/modules/registry.service';
import { ProjectManagementService } from '../../services/project-management.service';
import { getEmbeddingService } from '../../core/embeddings/generator.service';
import { 
  ProjectStatus, 
  TaskStatus, 
  TaskPriority, 
  DependencyType,
  ProjectSearchParams,
  TaskSearchParams
} from '../../modules/project-management/types';

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
  const embeddingService = getEmbeddingService();
  const projectService = new ProjectManagementService(embeddingService, cmiService);

  // Initialize project service
  (async () => {
    await projectService.initialize();
  })();

  // Always register public tools
  registerPublicTools(server, moduleRegistry);

  // Register authenticated tools - they will throw OAuth errors if no context
  registerAuthenticatedTools(server, cmiService, moduleRegistry, userContext);
  
  // Register project management tools
  registerProjectManagementTools(server, projectService, userContext);
  
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

/**
 * Register project management tools
 */
function registerProjectManagementTools(
  server: McpServer,
  projectService: ProjectManagementService,
  userContext?: UserContext
) {
  // Create project tool
  server.registerTool(
    'createProject',
    {
      title: 'Create Project',
      description: 'Create a new project',
      inputSchema: {
        name: z.string().describe('Project name'),
        description: z.string().optional().describe('Project description'),
        status: z.nativeEnum(ProjectStatus).optional().describe('Project status'),
        startDate: z.string().optional().describe('Project start date (ISO format)'),
        dueDate: z.string().optional().describe('Project due date (ISO format)'),
        owner: z.string().optional().describe('Project owner'),
        team: z.array(z.string()).optional().describe('Team members'),
        ministry: z.string().optional().describe('Ministry area'),
        progress: z.number().min(0).max(100).optional().describe('Project progress (0-100)'),
        metadata: z.record(z.any()).optional().describe('Additional metadata'),
      },
    },
    async ({ name, description, status, startDate, dueDate, owner, team, ministry, progress, metadata }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const projectData = {
          name,
          description,
          status: status || ProjectStatus.PLANNING,
          startDate: startDate ? new Date(startDate) : undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          owner,
          team,
          ministry,
          progress: progress || 0,
          metadata,
        };

        const project = await projectService.createProject(userContext!.userId, projectData);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(project, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP create project error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error creating project: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // List projects tool
  server.registerTool(
    'listProjects',
    {
      title: 'List Projects',
      description: 'List all projects with optional filtering',
      inputSchema: {
        status: z.nativeEnum(ProjectStatus).optional().describe('Filter by status'),
        owner: z.string().optional().describe('Filter by owner'),
        team: z.string().optional().describe('Filter by team member'),
        ministry: z.string().optional().describe('Filter by ministry'),
        dueBefore: z.string().optional().describe('Filter by due date before (ISO format)'),
        dueAfter: z.string().optional().describe('Filter by due date after (ISO format)'),
        searchTerm: z.string().optional().describe('Search term for name/description'),
        includeCompleted: z.boolean().optional().default(false).describe('Include completed projects'),
      },
    },
    async ({ status, owner, team, ministry, dueBefore, dueAfter, searchTerm, includeCompleted }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const searchParams: ProjectSearchParams = {
          status,
          owner,
          team,
          ministry,
          dueBefore: dueBefore ? new Date(dueBefore) : undefined,
          dueAfter: dueAfter ? new Date(dueAfter) : undefined,
          searchTerm,
          includeCompleted,
        };

        const projects = await projectService.searchProjects(userContext!.userId, searchParams);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(projects, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP list projects error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error listing projects: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Get project tool
  server.registerTool(
    'getProject',
    {
      title: 'Get Project',
      description: 'Get a specific project by ID',
      inputSchema: {
        projectId: z.string().describe('Project ID'),
      },
    },
    async ({ projectId }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const project = await projectService.getProject(userContext!.userId, projectId);
        if (!project) {
          throw new Error('Project not found');
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(project, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP get project error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting project: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Update project tool
  server.registerTool(
    'updateProject',
    {
      title: 'Update Project',
      description: 'Update an existing project',
      inputSchema: {
        projectId: z.string().describe('Project ID'),
        name: z.string().optional().describe('Project name'),
        description: z.string().optional().describe('Project description'),
        status: z.nativeEnum(ProjectStatus).optional().describe('Project status'),
        startDate: z.string().optional().describe('Project start date (ISO format)'),
        dueDate: z.string().optional().describe('Project due date (ISO format)'),
        owner: z.string().optional().describe('Project owner'),
        team: z.array(z.string()).optional().describe('Team members'),
        ministry: z.string().optional().describe('Ministry area'),
        progress: z.number().min(0).max(100).optional().describe('Project progress (0-100)'),
        metadata: z.record(z.any()).optional().describe('Additional metadata'),
      },
    },
    async ({ projectId, name, description, status, startDate, dueDate, owner, team, ministry, progress, metadata }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const updates: any = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (status !== undefined) updates.status = status;
        if (startDate !== undefined) updates.startDate = new Date(startDate);
        if (dueDate !== undefined) updates.dueDate = new Date(dueDate);
        if (owner !== undefined) updates.owner = owner;
        if (team !== undefined) updates.team = team;
        if (ministry !== undefined) updates.ministry = ministry;
        if (progress !== undefined) updates.progress = progress;
        if (metadata !== undefined) updates.metadata = metadata;

        const project = await projectService.updateProject(userContext!.userId, projectId, updates);
        if (!project) {
          throw new Error('Project not found');
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(project, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP update project error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error updating project: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Delete project tool
  server.registerTool(
    'deleteProject',
    {
      title: 'Delete Project',
      description: 'Delete a project and optionally its tasks',
      inputSchema: {
        projectId: z.string().describe('Project ID'),
        deleteTasks: z.boolean().optional().default(false).describe('Delete associated tasks'),
      },
    },
    async ({ projectId, deleteTasks }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const success = await projectService.deleteProject(userContext!.userId, projectId, deleteTasks);
        if (!success) {
          throw new Error('Project not found');
        }

        return {
          content: [
            {
              type: 'text',
              text: `Project deleted successfully${deleteTasks ? ' (with tasks)' : ''}`,
            },
          ],
        };
      } catch (error) {
        logger.error('MCP delete project error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error deleting project: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Get project tasks tool
  server.registerTool(
    'getProjectTasks',
    {
      title: 'Get Project Tasks',
      description: 'Get all tasks for a specific project',
      inputSchema: {
        projectId: z.string().describe('Project ID'),
      },
    },
    async ({ projectId }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const tasks = await projectService.getProjectTasks(userContext!.userId, projectId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tasks, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP get project tasks error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting project tasks: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Create task tool
  server.registerTool(
    'createTask',
    {
      title: 'Create Task',
      description: 'Create a new task',
      inputSchema: {
        projectId: z.string().optional().describe('Project ID (if task belongs to a project)'),
        title: z.string().describe('Task title'),
        description: z.string().optional().describe('Task description'),
        status: z.nativeEnum(TaskStatus).optional().describe('Task status'),
        priority: z.nativeEnum(TaskPriority).optional().describe('Task priority'),
        assignee: z.string().optional().describe('Task assignee'),
        dueDate: z.string().optional().describe('Task due date (ISO format)'),
        estimatedHours: z.number().positive().optional().describe('Estimated hours'),
        actualHours: z.number().positive().optional().describe('Actual hours'),
        ministry: z.string().optional().describe('Ministry area'),
        tags: z.array(z.string()).optional().describe('Tags'),
        metadata: z.record(z.any()).optional().describe('Additional metadata'),
      },
    },
    async ({ projectId, title, description, status, priority, assignee, dueDate, estimatedHours, actualHours, ministry, tags, metadata }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const taskData = {
          projectId,
          title,
          description,
          status: status || TaskStatus.TODO,
          priority: priority || TaskPriority.MEDIUM,
          assignee,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          estimatedHours,
          actualHours,
          ministry,
          tags,
          metadata,
        };

        const task = await projectService.createTask(userContext!.userId, taskData);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(task, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP create task error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error creating task: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // List tasks tool
  server.registerTool(
    'listTasks',
    {
      title: 'List Tasks',
      description: 'List all tasks with optional filtering',
      inputSchema: {
        projectId: z.string().optional().describe('Filter by project ID'),
        status: z.nativeEnum(TaskStatus).optional().describe('Filter by status'),
        assignee: z.string().optional().describe('Filter by assignee'),
        priority: z.nativeEnum(TaskPriority).optional().describe('Filter by priority'),
        ministry: z.string().optional().describe('Filter by ministry'),
        dueBefore: z.string().optional().describe('Filter by due date before (ISO format)'),
        dueAfter: z.string().optional().describe('Filter by due date after (ISO format)'),
        searchTerm: z.string().optional().describe('Search term for title/description'),
        includeCompleted: z.boolean().optional().default(false).describe('Include completed tasks'),
      },
    },
    async ({ projectId, status, assignee, priority, ministry, dueBefore, dueAfter, searchTerm, includeCompleted }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const searchParams: TaskSearchParams = {
          projectId,
          status,
          assignee,
          priority,
          ministry,
          dueBefore: dueBefore ? new Date(dueBefore) : undefined,
          dueAfter: dueAfter ? new Date(dueAfter) : undefined,
          searchTerm,
          includeCompleted,
        };

        const tasks = await projectService.searchTasks(userContext!.userId, searchParams);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tasks, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP list tasks error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error listing tasks: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Get task tool
  server.registerTool(
    'getTask',
    {
      title: 'Get Task',
      description: 'Get a specific task by ID',
      inputSchema: {
        taskId: z.string().describe('Task ID'),
      },
    },
    async ({ taskId }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const task = await projectService.getTask(userContext!.userId, taskId);
        if (!task) {
          throw new Error('Task not found');
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(task, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP get task error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting task: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Update task tool
  server.registerTool(
    'updateTask',
    {
      title: 'Update Task',
      description: 'Update an existing task',
      inputSchema: {
        taskId: z.string().describe('Task ID'),
        projectId: z.string().optional().describe('Project ID'),
        title: z.string().optional().describe('Task title'),
        description: z.string().optional().describe('Task description'),
        status: z.nativeEnum(TaskStatus).optional().describe('Task status'),
        priority: z.nativeEnum(TaskPriority).optional().describe('Task priority'),
        assignee: z.string().optional().describe('Task assignee'),
        dueDate: z.string().optional().describe('Task due date (ISO format)'),
        estimatedHours: z.number().positive().optional().describe('Estimated hours'),
        actualHours: z.number().positive().optional().describe('Actual hours'),
        ministry: z.string().optional().describe('Ministry area'),
        tags: z.array(z.string()).optional().describe('Tags'),
        metadata: z.record(z.any()).optional().describe('Additional metadata'),
      },
    },
    async ({ taskId, projectId, title, description, status, priority, assignee, dueDate, estimatedHours, actualHours, ministry, tags, metadata }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const updates: any = {};
        if (projectId !== undefined) updates.projectId = projectId;
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (status !== undefined) updates.status = status;
        if (priority !== undefined) updates.priority = priority;
        if (assignee !== undefined) updates.assignee = assignee;
        if (dueDate !== undefined) updates.dueDate = new Date(dueDate);
        if (estimatedHours !== undefined) updates.estimatedHours = estimatedHours;
        if (actualHours !== undefined) updates.actualHours = actualHours;
        if (ministry !== undefined) updates.ministry = ministry;
        if (tags !== undefined) updates.tags = tags;
        if (metadata !== undefined) updates.metadata = metadata;

        const task = await projectService.updateTask(userContext!.userId, taskId, updates);
        if (!task) {
          throw new Error('Task not found');
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(task, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP update task error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error updating task: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Delete task tool
  server.registerTool(
    'deleteTask',
    {
      title: 'Delete Task',
      description: 'Delete a task',
      inputSchema: {
        taskId: z.string().describe('Task ID'),
      },
    },
    async ({ taskId }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const success = await projectService.deleteTask(userContext!.userId, taskId);
        if (!success) {
          throw new Error('Task not found');
        }

        return {
          content: [
            {
              type: 'text',
              text: 'Task deleted successfully',
            },
          ],
        };
      } catch (error) {
        logger.error('MCP delete task error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error deleting task: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Add task dependency tool
  server.registerTool(
    'addTaskDependency',
    {
      title: 'Add Task Dependency',
      description: 'Add a dependency between two tasks',
      inputSchema: {
        taskId: z.string().describe('Task ID'),
        dependsOnTaskId: z.string().describe('Task ID that this task depends on'),
        dependencyType: z.nativeEnum(DependencyType).optional().describe('Dependency type'),
      },
    },
    async ({ taskId, dependsOnTaskId, dependencyType }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const success = await projectService.addTaskDependency(
          userContext!.userId,
          taskId,
          dependsOnTaskId,
          dependencyType || DependencyType.DEPENDS_ON
        );

        if (!success) {
          throw new Error('Failed to add dependency');
        }

        return {
          content: [
            {
              type: 'text',
              text: 'Task dependency added successfully',
            },
          ],
        };
      } catch (error) {
        logger.error('MCP add task dependency error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error adding task dependency: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Get task dependencies tool
  server.registerTool(
    'getTaskDependencies',
    {
      title: 'Get Task Dependencies',
      description: 'Get all dependencies for a specific task',
      inputSchema: {
        taskId: z.string().describe('Task ID'),
      },
    },
    async ({ taskId }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const dependencies = await projectService.getTaskDependencies(userContext!.userId, taskId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dependencies, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP get task dependencies error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting task dependencies: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Add subtask tool
  server.registerTool(
    'addSubtask',
    {
      title: 'Add Subtask',
      description: 'Add a subtask to a task',
      inputSchema: {
        taskId: z.string().describe('Task ID'),
        title: z.string().describe('Subtask title'),
        status: z.enum(['todo', 'in_progress', 'done']).optional().describe('Subtask status'),
        assignee: z.string().optional().describe('Subtask assignee'),
        dueDate: z.string().optional().describe('Subtask due date (ISO format)'),
      },
    },
    async ({ taskId, title, status, assignee, dueDate }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const subtaskData = {
          title,
          status: status || 'todo' as const,
          assignee,
          dueDate: dueDate ? new Date(dueDate) : undefined,
        };

        const subtask = await projectService.addSubtask(userContext!.userId, taskId, subtaskData);
        if (!subtask) {
          throw new Error('Task not found');
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(subtask, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP add subtask error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error adding subtask: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Update subtask tool
  server.registerTool(
    'updateSubtask',
    {
      title: 'Update Subtask',
      description: 'Update a subtask',
      inputSchema: {
        taskId: z.string().describe('Task ID'),
        subtaskId: z.string().describe('Subtask ID'),
        title: z.string().optional().describe('Subtask title'),
        status: z.enum(['todo', 'in_progress', 'done']).optional().describe('Subtask status'),
        assignee: z.string().optional().describe('Subtask assignee'),
        dueDate: z.string().optional().describe('Subtask due date (ISO format)'),
      },
    },
    async ({ taskId, subtaskId, title, status, assignee, dueDate }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const updates: any = {};
        if (title !== undefined) updates.title = title;
        if (status !== undefined) updates.status = status;
        if (assignee !== undefined) updates.assignee = assignee;
        if (dueDate !== undefined) updates.dueDate = new Date(dueDate);

        const subtask = await projectService.updateSubtask(userContext!.userId, taskId, subtaskId, updates);
        if (!subtask) {
          throw new Error('Task or subtask not found');
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(subtask, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP update subtask error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error updating subtask: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Add todo item tool
  server.registerTool(
    'addTodoItem',
    {
      title: 'Add Todo Item',
      description: 'Add a todo item to a task',
      inputSchema: {
        taskId: z.string().describe('Task ID'),
        text: z.string().describe('Todo item text'),
      },
    },
    async ({ taskId, text }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const todo = await projectService.addTodoItem(userContext!.userId, taskId, text);
        if (!todo) {
          throw new Error('Task not found');
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(todo, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP add todo item error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error adding todo item: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Toggle todo item tool
  server.registerTool(
    'toggleTodoItem',
    {
      title: 'Toggle Todo Item',
      description: 'Toggle completion status of a todo item',
      inputSchema: {
        taskId: z.string().describe('Task ID'),
        todoId: z.string().describe('Todo item ID'),
      },
    },
    async ({ taskId, todoId }) => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const success = await projectService.toggleTodoItem(userContext!.userId, taskId, todoId);
        if (!success) {
          throw new Error('Task or todo item not found');
        }

        return {
          content: [
            {
              type: 'text',
              text: 'Todo item toggled successfully',
            },
          ],
        };
      } catch (error) {
        logger.error('MCP toggle todo item error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error toggling todo item: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Get metadata tools
  server.registerTool(
    'getAssignees',
    {
      title: 'Get Assignees',
      description: 'Get list of all assignees',
      inputSchema: {},
    },
    async () => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const assignees = await projectService.getAssignees(userContext!.userId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(assignees, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP get assignees error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting assignees: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'getMinistries',
    {
      title: 'Get Ministries',
      description: 'Get list of all ministries',
      inputSchema: {},
    },
    async () => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const ministries = await projectService.getMinistries(userContext!.userId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(ministries, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP get ministries error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting ministries: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'getTags',
    {
      title: 'Get Tags',
      description: 'Get list of all tags',
      inputSchema: {},
    },
    async () => {
      if (!userContext) {
        throwAuthRequired();
      }

      try {
        const tags = await projectService.getTags(userContext!.userId);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tags, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('MCP get tags error', { error, userId: userContext?.userId });
        return {
          content: [
            {
              type: 'text',
              text: `Error getting tags: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}