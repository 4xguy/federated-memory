import { BaseModule, ModuleInfo } from '@/core/modules/base.module';
import { ModuleConfig, Memory, SearchOptions, ModuleStats, ModuleType } from '@/core/modules/interfaces';
import { prisma, vectorDb } from '@/utils/database';
import {
  Project,
  Task,
  ProjectStatus,
  TaskStatus,
  TaskPriority,
  ProjectMetadata,
  TaskMetadata,
  ProjectManagementMetadata,
  ProjectSearchParams,
  TaskSearchParams
} from './types';

export class ProjectManagementModule extends BaseModule {
  getModuleInfo(): ModuleInfo {
    return {
      name: 'Project Management',
      description: 'Manages projects, tasks, subtasks, and todo lists with ministry tracking',
      type: 'standard' as ModuleType,
    };
  }

  async processMetadata(
    content: string,
    metadata: Record<string, any>,
  ): Promise<Record<string, any>> {
    // Ensure metadata has a type field
    if (!metadata.type) {
      // Try to infer type from content or tags
      if (metadata.status && ['planning', 'active', 'on_hold', 'completed', 'cancelled'].includes(metadata.status)) {
        metadata.type = 'project';
      } else if (metadata.priority || metadata.projectId) {
        metadata.type = 'task';
      }
    }

    // Add importance score based on priority and due date
    if (metadata.type === 'task' && metadata.priority) {
      const priorityScores = { urgent: 1.0, high: 0.8, medium: 0.5, low: 0.3 };
      metadata.importanceScore = priorityScores[metadata.priority as keyof typeof priorityScores] || 0.5;
    } else if (metadata.type === 'project') {
      metadata.importanceScore = 0.7; // Projects generally important
    }

    // Extract categories
    const categories: string[] = [];
    if (metadata.type) categories.push(metadata.type);
    if (metadata.status) categories.push(`status:${metadata.status}`);
    if (metadata.priority) categories.push(`priority:${metadata.priority}`);
    if (metadata.ministry) categories.push(`ministry:${metadata.ministry}`);
    if (metadata.assignee) categories.push(`assignee:${metadata.assignee}`);
    
    metadata.categories = categories;

    return metadata;
  }

  formatSearchResult(memory: Memory): Memory {
    // Format the memory for display, potentially adding computed fields
    const metadata = memory.metadata as ProjectManagementMetadata;
    
    if (metadata.type === 'task' && metadata.dueDate) {
      // Add overdue flag
      const now = new Date();
      const dueDate = new Date(metadata.dueDate);
      if (dueDate < now && metadata.status !== 'done' && metadata.status !== 'cancelled') {
        metadata.isOverdue = true;
      }
    }

    return {
      ...memory,
      metadata
    };
  }

  async searchByEmbedding(
    userId: string,
    embedding: number[],
    options?: SearchOptions,
  ): Promise<Memory[]> {
    const limit = options?.limit || 10;
    const offset = options?.offset || 0;
    const minScore = options?.minScore || 0.5;

    // Build filter conditions
    const whereConditions: any[] = [{ userId }];
    
    if (options?.filters) {
      // Handle project/task specific filters
      if (options.filters.type) {
        whereConditions.push({
          metadata: {
            path: ['type'],
            equals: options.filters.type
          }
        });
      }
      
      if (options.filters.status) {
        whereConditions.push({
          metadata: {
            path: ['status'],
            equals: options.filters.status
          }
        });
      }

      if (options.filters.assignee) {
        whereConditions.push({
          metadata: {
            path: ['assignee'],
            equals: options.filters.assignee
          }
        });
      }

      if (options.filters.projectId) {
        whereConditions.push({
          metadata: {
            path: ['projectId'],
            equals: options.filters.projectId
          }
        });
      }

      if (options.filters.ministry) {
        whereConditions.push({
          metadata: {
            path: ['ministry'],
            equals: options.filters.ministry
          }
        });
      }
    }

    // Execute vector similarity search with filters
    const query = `
      SELECT 
        id,
        "userId",
        content,
        metadata,
        embedding,
        "accessCount",
        "lastAccessed",
        "createdAt",
        "updatedAt",
        1 - (embedding <=> $1::vector) as score
      FROM project_management_memories
      WHERE "userId" = $2
        AND 1 - (embedding <=> $1::vector) >= $3
        ${options?.filters ? 'AND metadata @> $4::jsonb' : ''}
      ORDER BY score DESC
      LIMIT $5 OFFSET $6
    `;

    const params = options?.filters 
      ? [JSON.stringify(embedding), userId, minScore, JSON.stringify(options.filters), limit, offset]
      : [JSON.stringify(embedding), userId, minScore, limit, offset];

    const results = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    return results.map(row => ({
      id: row.id,
      userId: row.userId,
      content: row.content,
      metadata: row.metadata,
      embedding: options?.includeEmbedding ? Array.from(row.embedding) : undefined,
      accessCount: row.accessCount,
      lastAccessed: row.lastAccessed,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  protected async storeInModule(
    userId: string,
    content: string,
    embedding: number[],
    metadata: Record<string, any>,
  ): Promise<Memory> {
    // Use vectorDb helper instead of raw SQL to ensure consistency
    const memory = await vectorDb.storeWithEmbedding('project_management_memories', {
      userId,
      content,
      embedding,
      metadata,
    });

    return memory;
  }

  protected async getFromModule(userId: string, memoryId: string): Promise<Memory | null> {
    const result = await prisma.$queryRaw<any[]>`
      SELECT * FROM project_management_memories
      WHERE id = ${memoryId} AND "userId" = ${userId}
    `;

    if (result.length === 0) return null;

    const memory = result[0];
    return {
      id: memory.id,
      userId: memory.userId,
      content: memory.content,
      metadata: memory.metadata,
      accessCount: memory.accessCount,
      lastAccessed: memory.lastAccessed,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    };
  }

  protected async updateInModule(
    userId: string,
    memoryId: string,
    updates: Partial<Memory>,
  ): Promise<boolean> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 3; // Starting after userId and memoryId

    if (updates.content !== undefined) {
      setClauses.push(`content = $${paramIndex}`);
      values.push(updates.content);
      paramIndex++;
    }

    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex}::jsonb`);
      values.push(updates.metadata);
      paramIndex++;
    }

    if (updates.embedding !== undefined) {
      setClauses.push(`embedding = $${paramIndex}::vector`);
      values.push(JSON.stringify(updates.embedding));
      paramIndex++;
    }

    setClauses.push(`"updatedAt" = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE project_management_memories
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND "userId" = $2
    `;

    const result = await prisma.$executeRawUnsafe(query, memoryId, userId, ...values);
    return result > 0;
  }

  protected async deleteFromModule(userId: string, memoryId: string): Promise<boolean> {
    const result = await prisma.$executeRaw`
      DELETE FROM project_management_memories
      WHERE id = ${memoryId} AND "userId" = ${userId}
    `;
    return result > 0;
  }

  protected async calculateStats(userId: string): Promise<ModuleStats> {
    const stats = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*)::int as "totalMemories",
        COALESCE(SUM(LENGTH(content)), 0)::bigint as "totalSize",
        MAX("lastAccessed") as "lastAccessed",
        AVG("accessCount")::float as "averageAccessCount"
      FROM project_management_memories
      WHERE "userId" = ${userId}
    `;

    const categoryCounts = await prisma.$queryRaw<any[]>`
      SELECT 
        jsonb_array_elements_text(metadata->'categories') as category,
        COUNT(*)::int as count
      FROM project_management_memories
      WHERE "userId" = ${userId}
        AND metadata ? 'categories'
      GROUP BY category
      ORDER BY count DESC
      LIMIT 5
    `;

    return {
      totalMemories: stats[0]?.totalMemories || 0,
      totalSize: parseInt(stats[0]?.totalSize || '0'),
      lastAccessed: stats[0]?.lastAccessed || undefined,
      averageAccessCount: stats[0]?.averageAccessCount || 0,
      mostFrequentCategories: categoryCounts.map(c => c.category),
    };
  }

  // Additional methods specific to project management

  async searchProjects(userId: string, params: ProjectSearchParams): Promise<Memory[]> {
    const filters: Record<string, any> = { type: 'project' };
    
    if (params.status) filters.status = params.status;
    if (params.owner) filters.owner = params.owner;
    if (params.ministry) filters.ministry = params.ministry;
    if (!params.includeCompleted) {
      filters.status = { $ne: 'completed' };
    }

    const searchOptions: SearchOptions = {
      filters,
      limit: 50,
      minScore: 0
    };

    // If there's a search term, use embedding search
    if (params.searchTerm) {
      const queryEmbedding = await this.embeddings.generateFullEmbedding(params.searchTerm);
      return this.searchByEmbedding(userId, queryEmbedding, searchOptions);
    }

    // Otherwise, do a metadata-based search
    return this.searchByMetadata(userId, filters);
  }

  async searchTasks(userId: string, params: TaskSearchParams): Promise<Memory[]> {
    const filters: Record<string, any> = { type: 'task' };
    
    if (params.projectId) filters.projectId = params.projectId;
    if (params.status) filters.status = params.status;
    if (params.assignee) filters.assignee = params.assignee;
    if (params.priority) filters.priority = params.priority;
    if (params.ministry) filters.ministry = params.ministry;
    if (!params.includeCompleted) {
      filters.status = { $nin: ['done', 'cancelled'] };
    }

    const searchOptions: SearchOptions = {
      filters,
      limit: 100,
      minScore: 0
    };

    // If there's a search term, use embedding search
    if (params.searchTerm) {
      const queryEmbedding = await this.embeddings.generateFullEmbedding(params.searchTerm);
      return this.searchByEmbedding(userId, queryEmbedding, searchOptions);
    }

    // Otherwise, do a metadata-based search
    return this.searchByMetadata(userId, filters);
  }

  async searchByMetadata(userId: string, filters: Record<string, any>): Promise<Memory[]> {
    const query = `
      SELECT 
        id,
        "userId",
        content,
        metadata,
        "accessCount",
        "lastAccessed",
        "createdAt",
        "updatedAt"
      FROM project_management_memories
      WHERE "userId" = $1
        AND metadata @> $2::jsonb
      ORDER BY "createdAt" DESC
      LIMIT 100
    `;

    const results = await prisma.$queryRawUnsafe<any[]>(query, userId, JSON.stringify(filters));

    return results.map(row => ({
      id: row.id,
      userId: row.userId,
      content: row.content,
      metadata: row.metadata,
      accessCount: row.accessCount,
      lastAccessed: row.lastAccessed,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  // Update access tracking
  protected async updateAccessCounts(memoryIds: string[]): Promise<void> {
    if (memoryIds.length === 0) return;

    await prisma.$executeRaw`
      UPDATE project_management_memories
      SET "accessCount" = "accessCount" + 1,
          "lastAccessed" = CURRENT_TIMESTAMP
      WHERE id = ANY(${memoryIds}::text[])
    `;
  }
}