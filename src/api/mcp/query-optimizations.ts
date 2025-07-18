/**
 * Optimized query functions using direct SQL instead of semantic search
 * for structured metadata queries
 */

import { prisma } from '@/utils/database';
import { Prisma } from '@prisma/client';

export const OptimizedQueries = {
  /**
   * List all projects for a user (SQL-optimized)
   */
  async listProjects(userId: string, includeCompleted = false) {
    const statusFilter = includeCompleted ? '' : `AND metadata->>'status' != 'completed'`;
    
    const projects = await prisma.$queryRaw<any[]>`
      SELECT 
        id,
        content,
        metadata,
        "createdAt",
        "updatedAt"
      FROM work_memories
      WHERE "userId" = ${userId}
        AND metadata->>'type' = 'project'
        ${Prisma.raw(statusFilter)}
      ORDER BY metadata->>'createdAt' DESC
    `;

    // Get task counts for each project
    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        const [countResult] = await prisma.$queryRaw<[{count: bigint}]>`
          SELECT COUNT(*) as count
          FROM work_memories
          WHERE "userId" = ${userId}
            AND metadata->>'type' = 'task'
            AND metadata->>'projectId' = ${project.metadata.id || project.id}
        `;

        return {
          ...project,
          taskCount: Number(countResult.count)
        };
      })
    );

    return projectsWithCounts;
  },

  /**
   * List all tasks with optional filters (SQL-optimized)
   */
  async listTasks(userId: string, filters: {
    projectId?: string;
    status?: string;
    assignee?: string;
    includeCompleted?: boolean;
  } = {}) {
    const conditions = [`"userId" = ${userId}`, `metadata->>'type' = 'task'`];
    
    if (filters.projectId) {
      conditions.push(`metadata->>'projectId' = '${filters.projectId}'`);
    }
    
    if (filters.status) {
      conditions.push(`metadata->>'status' = '${filters.status}'`);
    }
    
    if (filters.assignee) {
      conditions.push(`metadata->>'assignee' = '${filters.assignee}'`);
    }
    
    if (!filters.includeCompleted) {
      conditions.push(`(metadata->>'status' != 'done' AND metadata->>'status' != 'cancelled')`);
    }

    const whereClause = conditions.join(' AND ');

    return await prisma.$queryRaw`
      SELECT 
        id,
        content,
        metadata,
        "createdAt",
        "updatedAt"
      FROM work_memories
      WHERE ${Prisma.raw(whereClause)}
      ORDER BY 
        CASE metadata->>'priority'
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        metadata->>'dueDate' ASC NULLS LAST,
        metadata->>'createdAt' DESC
    `;
  },

  /**
   * Get registry by type (SQL-optimized)
   */
  async getRegistry(userId: string, registryType: string, moduleName = 'personal') {
    const [registry] = await prisma.$queryRaw<any[]>`
      SELECT 
        id,
        metadata,
        content
      FROM ${Prisma.raw(moduleName + '_memories')}
      WHERE "userId" = ${userId}
        AND metadata->>'type' = 'registry'
        AND metadata->>'registryType' = ${registryType}
      LIMIT 1
    `;

    return registry || null;
  },

  /**
   * Get all categories with counts (SQL-optimized)
   */
  async getCategoriesWithCounts(userId: string) {
    // First get the category registry
    const registry = await this.getRegistry(userId, 'categories');
    if (!registry) return [];

    const categories = registry.metadata.items || [];
    
    // Get counts for all categories in one query
    const counts = await prisma.$queryRaw<Array<{category: string, count: bigint}>>`
      SELECT 
        metadata->>'category' as category,
        COUNT(*) as count
      FROM (
        SELECT metadata FROM personal_memories WHERE "userId" = ${userId}
        UNION ALL
        SELECT metadata FROM work_memories WHERE "userId" = ${userId}
        UNION ALL
        SELECT metadata FROM technical_memories WHERE "userId" = ${userId}
        UNION ALL
        SELECT metadata FROM learning_memories WHERE "userId" = ${userId}
        UNION ALL
        SELECT metadata FROM creative_memories WHERE "userId" = ${userId}
        UNION ALL
        SELECT metadata FROM communication_memories WHERE "userId" = ${userId}
      ) AS all_memories
      WHERE metadata->>'category' IS NOT NULL
      GROUP BY metadata->>'category'
    `;

    // Create a map for quick lookup
    const countMap = new Map(counts.map(c => [c.category, Number(c.count)]));

    // Merge with registry data
    return categories.map((cat: any) => ({
      ...cat,
      memoryCount: countMap.get(cat.name) || 0
    }));
  },

  /**
   * Find task by ID (SQL-optimized)
   */
  async findTaskById(userId: string, taskId: string) {
    const [task] = await prisma.$queryRaw<any[]>`
      SELECT 
        id,
        content,
        metadata,
        "createdAt",
        "updatedAt"
      FROM work_memories
      WHERE "userId" = ${userId}
        AND metadata->>'type' = 'task'
        AND (id = ${taskId} OR metadata->>'id' = ${taskId})
      LIMIT 1
    `;

    return task || null;
  },

  /**
   * Get project tasks (SQL-optimized)
   */
  async getProjectTasks(userId: string, projectId: string) {
    return await prisma.$queryRaw`
      SELECT 
        id,
        content,
        metadata,
        "createdAt",
        "updatedAt"
      FROM work_memories
      WHERE "userId" = ${userId}
        AND metadata->>'type' = 'task'
        AND metadata->>'projectId' = ${projectId}
      ORDER BY metadata->>'createdAt' DESC
    `;
  },

  /**
   * Get task dependencies (SQL-optimized)
   */
  async getTaskDependencies(userId: string, taskId: string) {
    const dependencies = await prisma.$queryRaw<any[]>`
      SELECT 
        d.id as dependencyId,
        d.metadata as dependencyMetadata,
        t.id as taskId,
        t.metadata as taskMetadata
      FROM work_memories d
      LEFT JOIN work_memories t 
        ON t."userId" = ${userId}
        AND t.metadata->>'type' = 'task'
        AND (t.id = d.metadata->>'dependsOnTaskId' OR t.metadata->>'id' = d.metadata->>'dependsOnTaskId')
      WHERE d."userId" = ${userId}
        AND d.metadata->>'type' = 'task_dependency'
        AND d.metadata->>'taskId' = ${taskId}
    `;

    const dependents = await prisma.$queryRaw<any[]>`
      SELECT 
        d.id as dependencyId,
        d.metadata as dependencyMetadata,
        t.id as taskId,
        t.metadata as taskMetadata
      FROM work_memories d
      LEFT JOIN work_memories t 
        ON t."userId" = ${userId}
        AND t.metadata->>'type' = 'task'
        AND (t.id = d.metadata->>'taskId' OR t.metadata->>'id' = d.metadata->>'taskId')
      WHERE d."userId" = ${userId}
        AND d.metadata->>'type' = 'task_dependency'
        AND d.metadata->>'dependsOnTaskId' = ${taskId}
    `;

    return { dependencies, dependents };
  }
};