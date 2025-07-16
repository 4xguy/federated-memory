import { PrismaClient, Prisma } from '@prisma/client';
import { Logger } from '@/utils/logger';
import { getEmbeddingService } from '@/core/embeddings/generator.service';
import { ModuleRegistry } from '../modules/registry.service';
import { Redis } from '@/utils/redis';

export interface MemoryIndexEntry {
  id: string;
  userId: string;
  moduleId: string;
  remoteMemoryId: string;
  embedding: number[];
  title: string;
  summary: string;
  keywords: string[];
  categories: string[];
  importanceScore: number;
  accessCount: number;
  lastAccessed: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryRelationship {
  id: string;
  userId: string;
  sourceModule: string;
  sourceMemoryId: string;
  targetModule: string;
  targetMemoryId: string;
  relationshipType: string;
  strength: number;
  metadata: any;
}

export interface QueryResult {
  moduleId: string;
  remoteMemoryId: string;
  similarity: number;
  title: string;
  summary: string;
  importanceScore: number;
}

export interface ModuleRouting {
  moduleId: string;
  confidence: number;
  keywords: string[];
}

export class CMIService {
  private prisma: PrismaClient;
  private logger: Logger;
  private embeddingService: ReturnType<typeof getEmbeddingService>;
  private moduleRegistry: ModuleRegistry;
  private redis: Redis | null;
  private routingCache: Map<string, ModuleRouting[]> = new Map();

  constructor() {
    this.prisma = new PrismaClient();
    this.logger = Logger.getInstance();
    this.embeddingService = getEmbeddingService();
    this.moduleRegistry = ModuleRegistry.getInstance();
    this.redis = Redis.getInstance();
    
    // Ensure registry is initialized when CMI starts
    this.moduleRegistry.ensureInitialized().catch(err => {
      this.logger.error('Failed to initialize module registry in CMI', { error: err });
    });
  }

  /**
   * Index a new memory in the CMI
   */
  async indexMemory(
    userId: string,
    moduleId: string,
    remoteMemoryId: string,
    content: string,
    metadata: {
      title: string;
      summary: string;
      keywords?: string[];
      categories?: string[];
      importanceScore?: number;
    },
  ): Promise<MemoryIndexEntry> {
    try {
      // Generate compressed embedding for routing
      const embedding = await this.embeddingService.generateCompressedEmbedding(
        `${metadata.title} ${metadata.summary} ${content}`,
      );

      // Create or update index entry using raw SQL
      const existingEntry = await this.prisma.$queryRaw<any[]>`
        SELECT id FROM memory_index 
        WHERE "moduleId" = ${moduleId} AND "remoteMemoryId" = ${remoteMemoryId}
      `;

      let entry;
      if (existingEntry.length > 0) {
        // Update existing entry
        entry = await this.prisma.$queryRaw`
          UPDATE memory_index 
          SET 
            embedding = ${embedding}::vector,
            title = ${metadata.title},
            summary = ${metadata.summary},
            keywords = ${metadata.keywords || []}::text[],
            categories = ${metadata.categories || []}::text[],
            "importanceScore" = ${metadata.importanceScore || 0.5},
            "updatedAt" = ${new Date()}
          WHERE "moduleId" = ${moduleId} AND "remoteMemoryId" = ${remoteMemoryId}
          RETURNING id, "userId", "moduleId", "remoteMemoryId", 
            title, summary, keywords, categories, 
            "importanceScore", "accessCount", "lastAccessed",
            "createdAt", "updatedAt"
        `;
      } else {
        // Create new entry
        const id = await this.prisma.$queryRaw`
          INSERT INTO memory_index (
            id, "userId", "moduleId", "remoteMemoryId", embedding,
            title, summary, keywords, categories, "importanceScore", "updatedAt"
          ) VALUES (
            gen_random_uuid(),
            ${userId},
            ${moduleId},
            ${remoteMemoryId},
            ${embedding}::vector,
            ${metadata.title},
            ${metadata.summary},
            ${metadata.keywords || []}::text[],
            ${metadata.categories || []}::text[],
            ${metadata.importanceScore || 0.5},
            ${new Date()}
          )
          RETURNING id, "userId", "moduleId", "remoteMemoryId", 
            title, summary, keywords, categories, 
            "importanceScore", "accessCount", "lastAccessed",
            "createdAt", "updatedAt"
        `;
        entry = id;
      }

      this.logger.info('Memory indexed', {
        userId,
        moduleId,
        remoteMemoryId,
        title: metadata.title,
      });

      return Array.isArray(entry) ? entry[0] : (entry as any);
    } catch (error) {
      this.logger.error('Failed to index memory', {
        error,
        userId,
        moduleId,
        remoteMemoryId,
      });
      throw new Error(`Memory indexing failed: ${error}`);
    }
  }

  /**
   * Route a query to appropriate modules
   */
  async routeQuery(userId: string, query: string, limit: number = 3): Promise<ModuleRouting[]> {
    const cacheKey = `routing:${userId}:${query}`;

    // Check cache
    if (this.redis) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateCompressedEmbedding(query);

      // Search for similar memories across all modules
      const results = await this.prisma.$queryRaw<
        Array<{
          moduleId: string;
          avg_similarity: number;
          matched_keywords: string[];
        }>
      >`
        SELECT 
          "moduleId",
          AVG(1 - (embedding <=> ${queryEmbedding}::vector)) as avg_similarity,
          ARRAY_AGG(DISTINCT keyword) FILTER (WHERE keyword IS NOT NULL) as matched_keywords
        FROM memory_index
        CROSS JOIN LATERAL unnest(keywords) as keyword
        WHERE "userId" = ${userId}
          AND (
            LOWER(${query}) LIKE '%' || LOWER(keyword) || '%'
            OR 1 - (embedding <=> ${queryEmbedding}::vector) > 0.7
          )
        GROUP BY "moduleId"
        ORDER BY avg_similarity DESC
        LIMIT ${limit}
      `;

      // Convert to routing format
      const routings: ModuleRouting[] = results.map(r => ({
        moduleId: r.moduleId,
        confidence: r.avg_similarity,
        keywords: r.matched_keywords || [],
      }));

      // Cache results
      if (this.redis && routings.length > 0) {
        await this.redis.set(cacheKey, JSON.stringify(routings), 300); // 5 min TTL
      }

      return routings;
    } catch (error) {
      this.logger.error('Query routing failed', { error, userId, query });
      throw new Error(`Query routing failed: ${error}`);
    }
  }

  /**
   * Search memories within specific modules
   */
  async searchMemories(
    userId: string,
    query: string,
    moduleIds?: string[],
    limit: number = 10,
  ): Promise<QueryResult[]> {
    try {
      const queryEmbedding = await this.embeddingService.generateCompressedEmbedding(query);

      // Build module filter
      const moduleFilter =
        moduleIds && moduleIds.length > 0
          ? Prisma.sql`AND "moduleId" = ANY(${moduleIds})`
          : Prisma.empty;

      // Search with similarity
      const results = await this.prisma.$queryRaw<QueryResult[]>`
        SELECT 
          "moduleId",
          "remoteMemoryId",
          1 - (embedding <=> ${queryEmbedding}::vector) as similarity,
          title,
          summary,
          "importanceScore"
        FROM memory_index
        WHERE "userId" = ${userId}
          ${moduleFilter}
        ORDER BY 
          (1 - (embedding <=> ${queryEmbedding}::vector)) * "importanceScore" DESC,
          "lastAccessed" DESC
        LIMIT ${limit}
      `;

      // Update access counts
      if (results.length > 0) {
        const memoryIds = results.map(r => ({
          moduleId: r.moduleId,
          remoteMemoryId: r.remoteMemoryId,
        }));

        await this.updateAccessCounts(memoryIds);
      }

      return results;
    } catch (error) {
      this.logger.error('Memory search failed', { error, userId, query });
      throw new Error(`Memory search failed: ${error}`);
    }
  }

  /**
   * Create relationship between memories
   */
  async createRelationship(
    userId: string,
    source: { moduleId: string; memoryId: string },
    target: { moduleId: string; memoryId: string },
    relationshipType: string,
    strength: number = 0.5,
    metadata?: any,
  ): Promise<MemoryRelationship> {
    try {
      const relationship = await this.prisma.memoryRelationship.create({
        data: {
          userId,
          sourceModule: source.moduleId,
          sourceMemoryId: source.memoryId,
          targetModule: target.moduleId,
          targetMemoryId: target.memoryId,
          relationshipType,
          strength,
          metadata: metadata || {},
        },
      });

      this.logger.info('Memory relationship created', {
        userId,
        source,
        target,
        relationshipType,
      });

      return relationship;
    } catch (error) {
      this.logger.error('Failed to create relationship', {
        error,
        userId,
        source,
        target,
      });
      throw new Error(`Relationship creation failed: ${error}`);
    }
  }

  /**
   * Get related memories
   */
  async getRelatedMemories(
    userId: string,
    moduleId: string,
    memoryId: string,
    relationshipTypes?: string[],
    limit: number = 5,
  ): Promise<Array<MemoryRelationship & { memory: QueryResult }>> {
    try {
      const typeFilter =
        relationshipTypes && relationshipTypes.length > 0
          ? Prisma.sql`AND "relationshipType" = ANY(${relationshipTypes})`
          : Prisma.empty;

      const relationships = await this.prisma.$queryRaw<
        Array<MemoryRelationship & { memory: QueryResult }>
      >`
        WITH related AS (
          SELECT 
            r.*,
            CASE 
              WHEN r."sourceModule" = ${moduleId} AND r."sourceMemoryId" = ${memoryId}
              THEN r."targetModule"
              ELSE r."sourceModule"
            END as related_module,
            CASE 
              WHEN r."sourceModule" = ${moduleId} AND r."sourceMemoryId" = ${memoryId}
              THEN r."targetMemoryId"
              ELSE r."sourceMemoryId"
            END as related_memory_id
          FROM memory_relationships r
          WHERE r."userId" = ${userId}
            AND (
              (r."sourceModule" = ${moduleId} AND r."sourceMemoryId" = ${memoryId})
              OR (r."targetModule" = ${moduleId} AND r."targetMemoryId" = ${memoryId})
            )
            ${typeFilter}
        )
        SELECT 
          r.*,
          json_build_object(
            'moduleId', m."moduleId",
            'remoteMemoryId', m."remoteMemoryId",
            'title', m.title,
            'summary', m.summary,
            'importanceScore', m."importanceScore"
          ) as memory
        FROM related r
        JOIN memory_index m ON 
          m."moduleId" = r.related_module 
          AND m."remoteMemoryId" = r.related_memory_id
        ORDER BY r.strength DESC
        LIMIT ${limit}
      `;

      return relationships;
    } catch (error) {
      this.logger.error('Failed to get related memories', {
        error,
        userId,
        moduleId,
        memoryId,
      });
      throw new Error(`Related memories query failed: ${error}`);
    }
  }

  /**
   * Update access statistics
   */
  private async updateAccessCounts(
    memories: Array<{ moduleId: string; remoteMemoryId: string }>,
  ): Promise<void> {
    try {
      for (const memory of memories) {
        await this.prisma.$executeRaw`
          UPDATE memory_index 
          SET 
            "accessCount" = "accessCount" + 1,
            "lastAccessed" = NOW()
          WHERE "moduleId" = ${memory.moduleId} 
            AND "remoteMemoryId" = ${memory.remoteMemoryId}
        `;
      }
    } catch (error) {
      this.logger.warn('Failed to update access counts', { error });
    }
  }

  /**
   * Get module statistics
   */
  async getModuleStats(userId: string): Promise<
    Array<{
      moduleId: string;
      memoryCount: number;
      avgImportance: number;
      totalAccess: number;
    }>
  > {
    try {
      const stats = await this.prisma.memoryIndex.groupBy({
        by: ['moduleId'],
        where: { userId },
        _count: { id: true },
        _avg: { importanceScore: true },
        _sum: { accessCount: true },
      });

      return stats.map(s => ({
        moduleId: s.moduleId,
        memoryCount: s._count.id,
        avgImportance: s._avg.importanceScore || 0,
        totalAccess: s._sum.accessCount || 0,
      }));
    } catch (error) {
      this.logger.error('Failed to get module stats', { error, userId });
      throw new Error(`Module stats query failed: ${error}`);
    }
  }

  /**
   * Delete memory from index
   */
  async deleteMemory(moduleId: string, remoteMemoryId: string): Promise<void> {
    try {
      // Delete relationships
      await this.prisma.memoryRelationship.deleteMany({
        where: {
          OR: [
            { sourceModule: moduleId, sourceMemoryId: remoteMemoryId },
            { targetModule: moduleId, targetMemoryId: remoteMemoryId },
          ],
        },
      });

      // Delete index entry
      await this.prisma.memoryIndex.delete({
        where: {
          moduleId_remoteMemoryId: {
            moduleId,
            remoteMemoryId,
          },
        },
      });

      this.logger.info('Memory deleted from index', { moduleId, remoteMemoryId });
    } catch (error) {
      this.logger.error('Failed to delete memory', { error, moduleId, remoteMemoryId });
      throw new Error(`Memory deletion failed: ${error}`);
    }
  }

  /**
   * Store a new memory through CMI
   */
  async store(
    userId: string,
    content: string,
    metadata?: Record<string, any>,
    moduleId?: string,
  ): Promise<string> {
    try {
      // Determine module based on content if not specified
      const targetModule = moduleId || (await this.determineModule(content, metadata));

      // Get the module instance
      this.logger.info('Attempting to get module', { targetModule });
      const module = await this.moduleRegistry.getModule(targetModule);
      if (!module) {
        // Try to load the module if it's not already loaded
        const { ModuleLoader } = await import('@/core/modules/loader.service');
        const loader = ModuleLoader.getInstance();
        
        this.logger.info('Module not loaded, attempting to load it', { targetModule });
        const loadResult = await loader.loadModule(targetModule);
        
        if (loadResult.success) {
          // Try again after loading
          const loadedModule = await this.moduleRegistry.getModule(targetModule);
          if (loadedModule) {
            return await this.store(userId, content, metadata, moduleId);
          }
        }
        
        this.logger.error('Module not found or failed to load', {
          targetModule,
          loadResult,
          registryInfo: {
            hasRegistry: !!this.moduleRegistry,
            registryType: this.moduleRegistry?.constructor?.name
          }
        });
        throw new Error(`Module ${targetModule} not found or failed to load`);
      }

      // Store in the module
      const memoryId = await module.store(userId, content, metadata);

      this.logger.info('Memory stored through CMI', { userId, moduleId: targetModule, memoryId });

      return memoryId;
    } catch (error) {
      this.logger.error('Failed to store memory through CMI', { error });
      throw error;
    }
  }

  /**
   * Search memories through CMI
   */
  async search(
    userId: string,
    query: string,
    options?: {
      moduleId?: string;
      limit?: number;
      minScore?: number;
    },
  ): Promise<any[]> {
    try {
      // If specific module requested, search directly in that module
      if (options?.moduleId) {
        const module = await this.moduleRegistry.getModule(options.moduleId);
        if (!module) {
          throw new Error(`Module ${options.moduleId} not found`);
        }
        return await module.search(userId, query, options);
      }

      // Otherwise use CMI routing
      const limit = options?.limit || 10;
      const results = await this.searchMemories(userId, query, undefined, limit);

      // If CMI index returns results, use them
      if (results.length > 0) {
        // Fetch full memories from modules
        const fullMemories = await Promise.all(
          results.map(async result => {
            const module = await this.moduleRegistry.getModule(result.moduleId);
            if (module) {
              const memory = await module.get(userId, result.remoteMemoryId);
              return memory
                ? { ...memory, moduleId: result.moduleId, score: result.similarity }
                : null;
            }
            return null;
          }),
        );

        return fullMemories.filter(m => m !== null);
      }

      // Fallback: If no results from index, search all modules directly
      this.logger.warn('CMI index returned no results, falling back to module search', { userId, query });
      
      const modules = await this.moduleRegistry.listModules();
      const allResults: any[] = [];

      // Search each module in parallel
      await Promise.all(
        modules.map(async moduleInfo => {
          try {
            const module = await this.moduleRegistry.getModule(moduleInfo.id);
            if (module) {
              const moduleResults = await module.search(userId, query, { 
                limit: Math.ceil(limit / modules.length), 
                minScore: options?.minScore 
              });
              
              // Add module ID to each result
              moduleResults.forEach(result => {
                allResults.push({ ...result, moduleId: moduleInfo.id });
              });
            }
          } catch (error) {
            this.logger.warn('Module search failed', { module: moduleInfo.id, error });
          }
        }),
      );

      // Sort by score and return top results
      return allResults
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to search memories through CMI', { error });
      throw error;
    }
  }

  /**
   * Get a specific memory through CMI
   */
  async get(userId: string, memoryId: string): Promise<any | null> {
    try {
      // First check if it's in the index
      const indexEntry = await this.prisma.memoryIndex.findFirst({
        where: {
          userId,
          remoteMemoryId: memoryId,
        },
      });

      if (!indexEntry) {
        // Try each module
        const modules = await this.moduleRegistry.listModules();
        for (const moduleInfo of modules) {
          const module = await this.moduleRegistry.getModule(moduleInfo.id);
          if (module) {
            const memory = await module.get(userId, memoryId);
            if (memory) {
              return { ...memory, moduleId: moduleInfo.id };
            }
          }
        }
        return null;
      }

      // Get from specific module
      const module = await this.moduleRegistry.getModule(indexEntry.moduleId);
      if (!module) {
        return null;
      }

      const memory = await module.get(userId, indexEntry.remoteMemoryId);
      return memory ? { ...memory, moduleId: indexEntry.moduleId } : null;
    } catch (error) {
      this.logger.error('Failed to get memory through CMI', { error });
      throw error;
    }
  }

  /**
   * Update a memory through CMI
   */
  async update(
    userId: string,
    memoryId: string,
    updates: { content?: string; metadata?: Record<string, any> },
  ): Promise<boolean> {
    try {
      // Find which module has this memory
      const indexEntry = await this.prisma.memoryIndex.findFirst({
        where: {
          userId,
          remoteMemoryId: memoryId,
        },
      });

      if (!indexEntry) {
        // Try each module
        const modules = await this.moduleRegistry.listModules();
        for (const moduleInfo of modules) {
          const module = await this.moduleRegistry.getModule(moduleInfo.id);
          if (module) {
            const success = await module.update(userId, memoryId, updates);
            if (success) {
              return true;
            }
          }
        }
        return false;
      }

      // Update in specific module
      const module = await this.moduleRegistry.getModule(indexEntry.moduleId);
      if (!module) {
        return false;
      }

      return await module.update(userId, indexEntry.remoteMemoryId, updates);
    } catch (error) {
      this.logger.error('Failed to update memory through CMI', { error });
      throw error;
    }
  }

  /**
   * Delete a memory through CMI
   */
  async delete(userId: string, memoryId: string): Promise<boolean> {
    try {
      // Find which module has this memory
      const indexEntry = await this.prisma.memoryIndex.findFirst({
        where: {
          userId,
          remoteMemoryId: memoryId,
        },
      });

      if (!indexEntry) {
        // Try each module
        const modules = await this.moduleRegistry.listModules();
        for (const moduleInfo of modules) {
          const module = await this.moduleRegistry.getModule(moduleInfo.id);
          if (module) {
            const success = await module.delete(userId, memoryId);
            if (success) {
              return true;
            }
          }
        }
        return false;
      }

      // Delete from specific module
      const module = await this.moduleRegistry.getModule(indexEntry.moduleId);
      if (!module) {
        return false;
      }

      return await module.delete(userId, indexEntry.remoteMemoryId);
    } catch (error) {
      this.logger.error('Failed to delete memory through CMI', { error });
      throw error;
    }
  }

  /**
   * Determine which module should handle a memory based on content
   */
  private async determineModule(content: string, metadata?: Record<string, any>): Promise<string> {
    // Simple heuristic for now - can be enhanced with AI classification
    const lowerContent = content.toLowerCase();

    if (metadata?.moduleId) {
      return metadata.moduleId;
    }

    // Check for code patterns
    if (
      lowerContent.includes('function') ||
      lowerContent.includes('class') ||
      lowerContent.includes('import') ||
      lowerContent.includes('const ')
    ) {
      return 'technical';
    }

    // Check for work patterns
    if (
      lowerContent.includes('meeting') ||
      lowerContent.includes('project') ||
      lowerContent.includes('deadline') ||
      lowerContent.includes('task')
    ) {
      return 'work';
    }

    // Check for learning patterns
    if (
      lowerContent.includes('learn') ||
      lowerContent.includes('study') ||
      lowerContent.includes('understand') ||
      lowerContent.includes('course')
    ) {
      return 'learning';
    }

    // Check for communication patterns
    if (
      lowerContent.includes('email') ||
      lowerContent.includes('message') ||
      lowerContent.includes('call') ||
      lowerContent.includes('chat')
    ) {
      return 'communication';
    }

    // Check for creative patterns
    if (
      lowerContent.includes('idea') ||
      lowerContent.includes('design') ||
      lowerContent.includes('create') ||
      lowerContent.includes('art')
    ) {
      return 'creative';
    }

    // Default to personal
    return 'personal';
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Export singleton instance
let cmiService: CMIService | null = null;

export function getCMIService(): CMIService | null {
  if (!cmiService) {
    try {
      cmiService = new CMIService();
    } catch (error) {
      Logger.getInstance().error('Failed to create CMI service', { error });
      return null as any;
    }
  }
  return cmiService;
}
