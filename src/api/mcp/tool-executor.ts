import { logger } from '@/utils/logger';
import { getCMIService } from '../../core/cmi/index.service';
import { ModuleRegistry } from '../../core/modules/registry.service';
import { ProjectManagementService } from '../../services/project-management.service';
import { ChurchService } from '../../services/church.service';
import { getEmbeddingService } from '../../core/embeddings/generator.service';
import { prisma } from '@/utils/database';
import { OptimizedQueries } from './query-optimizations';
import { randomUUID } from 'crypto';
import { TaskStatus } from '../../modules/project-management/types';

// Service instances (cached)
let cmiService: any = null;
let projectService: ProjectManagementService | null = null;
let churchService: ChurchService | null = null;

function getServices() {
  if (!cmiService) {
    cmiService = getCMIService();
  }
  
  if (!projectService) {
    const embeddingService = getEmbeddingService();
    projectService = new ProjectManagementService(embeddingService, cmiService);
    projectService.initialize().catch(err => logger.error('Failed to initialize project service', { error: err }));
  }
  
  if (!churchService) {
    const embeddingService = getEmbeddingService();
    churchService = new ChurchService(embeddingService, cmiService);
    churchService.initialize().catch(err => logger.error('Failed to initialize church service', { error: err }));
  }
  
  return { cmiService, projectService, churchService };
}

/**
 * Execute a tool for a specific user
 * This centralizes all tool execution logic
 */
export async function executeToolForUser(toolName: string, args: any, userId: string): Promise<any> {
  const { cmiService, projectService, churchService } = getServices();
  const moduleRegistry = ModuleRegistry.getInstance();
  
  logger.info('Executing tool', { tool: toolName, userId });
  
  switch (toolName) {
    // Core Memory Tools
    case 'searchMemory':
      const searchResults = await cmiService.search(userId, args.query, {
        limit: args.limit || 10,
        modules: args.modules
      });
      
      const results = Array.isArray(searchResults) ? searchResults : [];
      
      return {
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
      
    case 'storeMemory':
      const content = typeof args.content === 'string' 
        ? args.content 
        : JSON.stringify(args.content);
      
      const memoryId = await cmiService.store(
        userId, 
        content,
        { ...args.metadata, source: 'mcp' },
        undefined // Let CMI determine the module
      );
      
      return {
        success: true,
        message: 'Memory stored successfully',
        memoryId: memoryId,
        moduleId: 'auto-determined'
      };
      
    case 'listModules':
      const modules = await moduleRegistry.listModules();
      
      return {
        modules: modules.map(m => ({
          id: m.id,
          name: m.name,
          description: m.description,
          type: m.type
        })),
        count: modules.length
      };
      
    case 'getModuleStats':
      const stats = await prisma.memoryIndex.groupBy({
        by: ['moduleId'],
        where: args.moduleId ? { moduleId: args.moduleId, userId } : { userId },
        _count: true
      });
      
      return {
        stats: stats.map(s => ({
          moduleId: s.moduleId,
          memoryCount: s._count
        })),
        total: stats.reduce((sum, s) => sum + s._count, 0)
      };
      
    case 'getMemory':
      const memory = await cmiService.get(userId, args.memoryId);
      
      if (!memory) {
        throw new Error('Memory not found');
      }
      
      return {
        memory: memory,
        message: 'Memory retrieved successfully'
      };
      
    case 'updateMemory':
      const existingMemory = await cmiService.get(userId, args.memoryId);
      if (!existingMemory) {
        throw new Error('Memory not found');
      }
      
      const module = await moduleRegistry.getModule(existingMemory.moduleId);
      if (!module) {
        throw new Error('Module not found');
      }
      
      const updates: any = {};
      if (args.content !== undefined) updates.content = args.content;
      if (args.metadata !== undefined) updates.metadata = args.metadata;
      
      const success = await module.update(userId, args.memoryId, updates);
      
      return {
        success: success,
        message: success ? 'Memory updated successfully' : 'Failed to update memory',
        memoryId: args.memoryId
      };
      
    case 'removeMemory':
      const memoryToRemove = await cmiService.get(userId, args.memoryId);
      if (!memoryToRemove) {
        throw new Error('Memory not found');
      }
      
      const removeModule = await moduleRegistry.getModule(memoryToRemove.moduleId);
      if (!removeModule) {
        throw new Error('Module not found');
      }
      
      const removed = await removeModule.delete(userId, args.memoryId);
      
      return {
        success: removed,
        message: removed ? 'Memory removed successfully' : 'Failed to remove memory',
        memoryId: args.memoryId
      };
      
    // Category Management
    case 'searchCategories':
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
        
        return {
          categories: categories,
          count: categories.length,
          message: categories.length > 0 ? `Found ${categories.length} categories` : 'No categories found'
        };
      } catch (dbError) {
        // Fallback if database function doesn't exist yet
        logger.warn('Category count function not available, using fallback', { error: dbError });
        
        const registrySearch = await OptimizedQueries.getRegistry(
          userId,
          'categories',
          'personal'
        );
        
        let categories = [];
        if (registrySearch && registrySearch.metadata?.items) {
          categories = registrySearch.metadata.items.map((cat: any) => ({
            ...cat,
            memoryCount: 0
          }));
        }
        
        return {
          categories: categories,
          count: categories.length,
          message: 'Category counts unavailable - database migration pending'
        };
      }
      
    case 'createCategory':
      const categoryId = randomUUID();
      
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
        categories[existingIndex] = { ...categories[existingIndex], ...newCategory };
      } else {
        categories.push(newCategory);
      }
      
      if (registryMemory) {
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
      
      return {
        success: true,
        message: existingIndex >= 0 ? 'Category updated successfully' : 'Category created successfully',
        category: newCategory
      };
      
    // Project Management Tools
    case 'createProject':
      return await projectService!.createProject(userId, args);
      
    case 'listProjects':
      return await projectService!.searchProjects(userId, args);
      
    case 'getProjectTasks':
      return await projectService!.getProjectTasks(userId, args.projectId);
      
    case 'createTask':
      return await projectService!.createTask(userId, args);
      
    case 'updateTaskStatus':
      return await projectService!.updateTask(userId, args.taskId, { status: args.status });
      
    case 'linkTaskDependency':
      return await projectService!.addTaskDependency(
        userId,
        args.taskId,
        args.dependsOnTaskId,
        args.dependencyType
      );
      
    case 'listTasks':
      return await projectService!.searchTasks(userId, args);
      
    case 'getTaskDependencies':
      return await projectService!.getTaskDependencies(userId, args.taskId);
      
    case 'createRecurringTask':
      // Recurring tasks not implemented yet, create a normal task
      return await projectService!.createTask(userId, {
        title: args.title,
        description: args.description,
        assignee: args.assignee,
        priority: args.priority || 'medium',
        status: TaskStatus.TODO, // Required field
        projectId: args.projectId,
        ministry: args.ministry
      });
      
    // Church Module Tools
    case 'createPerson':
      return await churchService!.createPerson(userId, args);
      
    case 'updatePerson':
      return await churchService!.updatePerson(userId, args.personId, args.updates);
      
    case 'getPerson':
      return await churchService!.getPerson(userId, args.personId);
      
    case 'searchPeople':
      return await churchService!.searchPeople(userId, args);
      
    case 'listPeople':
      return await churchService!.listPeople(userId, args);
      
    case 'mergePeople':
      return await churchService!.mergePeople(userId, args.sourceId, args.targetId);
      
    case 'createHousehold':
      return await churchService!.createHousehold(userId, args);
      
    case 'updateHousehold':
      return await churchService!.updateHousehold(userId, args.householdId, args.updates);
      
    case 'addPersonToHousehold':
      return await churchService!.addPersonToHousehold(
        userId,
        args.personId,
        args.householdId,
        args.role
      );
      
    case 'defineCustomField':
      return await churchService!.defineCustomField(userId, args);
      
    case 'setPersonCustomField':
      return await churchService!.setPersonCustomField(
        userId,
        args.personId,
        args.fieldKey,
        args.value,
        args.module || 'people'
      );
      
    case 'listCustomFields':
      return await churchService!.getCustomFieldsForModule(userId, args.module || 'people');
      
    case 'tagPerson':
      return await churchService!.tagPerson(
        userId,
        args.personId,
        args.tags,
        args.operation
      );
      
    case 'createPeopleList':
      return await churchService!.createPeopleList(userId, args.name, args.description, args.filters);
      
    case 'exportPeopleData':
      return await churchService!.exportPeopleData(userId, args);
      
    case 'bulkUpdatePeople':
      const bulkOp: any = {
        operation: args.operation,
        targetIds: args.targetIds
      };
      
      // Map the value based on operation
      if (args.operation === 'tag' || args.operation === 'untag') {
        bulkOp.tags = Array.isArray(args.value) ? args.value : [args.value];
      } else if (args.operation === 'assign') {
        bulkOp.ministry = args.value;
      } else if (args.operation === 'update') {
        bulkOp.updates = args.value;
      }
      
      return await churchService!.bulkUpdatePeople(userId, bulkOp);
      
    case 'assignMinistryRole':
      return await churchService!.assignMinistryRole(
        userId,
        args.personId,
        args.ministryName,
        args.role
      );
      
    case 'listMinistryMembers':
      return await churchService!.listMinistryMembers(userId, args.ministryName);
      
    case 'trackAttendance':
      return await churchService!.trackAttendance(
        userId,
        args.personId,
        args.eventType,
        args.eventName,
        args.date,
        args.status
      );
      
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}