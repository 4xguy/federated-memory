import { PrismaClient } from '@prisma/client';
import {
  MemoryModule,
  ModuleConfig,
  Memory,
  SearchOptions,
  ModuleStats,
  ModuleError,
  ModuleType,
} from './interfaces';
import { getCMIService } from '../cmi/index.service';
import { getEmbeddingService } from '../embeddings/generator.service';
import { createModuleLogger } from '../../utils/logger';
import { Redis } from '../../utils/redis';
import { prisma as sharedPrisma } from '../../utils/database';

export interface ModuleInfo {
  name: string;
  description: string;
  type: ModuleType;
}

export abstract class BaseModule implements MemoryModule {
  protected prisma: PrismaClient;
  protected cmi: ReturnType<typeof getCMIService> | null;
  protected embeddings: ReturnType<typeof getEmbeddingService>;
  protected logger: ReturnType<typeof createModuleLogger>;
  protected redis: Redis | null;

  constructor(
    protected config: ModuleConfig,
    prisma?: PrismaClient,
    cmi?: ReturnType<typeof getCMIService>,
  ) {
    this.prisma = prisma || sharedPrisma;
    this.cmi = cmi || getCMIService();
    this.embeddings = getEmbeddingService();
    this.logger = createModuleLogger(config.id);
    this.redis = Redis.getInstance();
  }

  // ============= Core Methods =============

  async store(userId: string, content: string, metadata?: Record<string, any>): Promise<string> {
    try {
      // Generate embeddings
      const fullEmbedding = await this.embeddings.generateFullEmbedding(content);
      const compressedEmbedding = await this.embeddings.generateCompressedEmbedding(content);

      // Extract module-specific metadata
      const enrichedMetadata = await this.processMetadata(content, metadata || {});

      // Store in module table
      const memory = await this.storeInModule(userId, content, fullEmbedding, enrichedMetadata);

      // Update CMI
      try {
        if (this.cmi) {
          await this.cmi.indexMemory(userId, this.config.id, memory.id, content, {
            title: this.extractTitle(content),
            summary: await this.generateSummary(content),
            keywords: this.extractKeywords(content),
            categories: enrichedMetadata.categories || [],
            importanceScore: enrichedMetadata.importanceScore || 0.5,
          });
        }
        this.logger.info('Memory indexed in CMI', { userId, memoryId: memory.id, module: this.config.id });
      } catch (indexError) {
        this.logger.error('Failed to index memory in CMI', { error: indexError, userId, memoryId: memory.id });
        // Don't throw - memory is stored, just not indexed
      }

      // Invalidate cache
      await this.invalidateCache(userId);

      this.logger.info('Memory stored', { userId, memoryId: memory.id, module: this.config.id });

      return memory.id;
    } catch (error) {
      throw new ModuleError(
        this.config.id,
        'STORE_ERROR',
        'Failed to store memory',
        error as Error,
      );
    }
  }

  async search(userId: string, query: string, options?: SearchOptions): Promise<Memory[]> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(userId, 'search', query, options);
      if (this.redis) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // Generate query embedding
      const queryEmbedding = await this.embeddings.generateFullEmbedding(query);

      // Search with embedding
      const results = await this.searchByEmbedding(userId, queryEmbedding, options);

      // Cache results
      if (this.redis && results.length > 0) {
        await this.redis.set(cacheKey, JSON.stringify(results), 300); // 5 min TTL
      }

      return results;
    } catch (error) {
      throw new ModuleError(
        this.config.id,
        'SEARCH_ERROR',
        'Failed to search memories',
        error as Error,
      );
    }
  }

  async get(userId: string, memoryId: string): Promise<Memory | null> {
    try {
      const memory = await this.getFromModule(userId, memoryId);

      if (memory) {
        await this.updateAccessCounts([memoryId]);
      }

      return memory;
    } catch (error) {
      throw new ModuleError(this.config.id, 'GET_ERROR', 'Failed to get memory', error as Error);
    }
  }

  async update(userId: string, memoryId: string, updates: Partial<Memory>): Promise<boolean> {
    try {
      // If content is updated, regenerate embeddings
      let newEmbedding: number[] | undefined;

      if (updates.content) {
        newEmbedding = await this.embeddings.generateFullEmbedding(updates.content);
      }

      // Update in module
      const success = await this.updateInModule(userId, memoryId, {
        ...updates,
        embedding: newEmbedding,
      });

      // Update CMI if needed
      if (success && (updates.content || updates.metadata) && this.cmi) {
        await this.cmi.indexMemory(userId, this.config.id, memoryId, updates.content || '', {
          title: updates.content ? this.extractTitle(updates.content) : '',
          summary: updates.content ? await this.generateSummary(updates.content) : '',
          keywords: updates.content ? this.extractKeywords(updates.content) : [],
          categories: updates.metadata?.categories || [],
        });
      }

      // Invalidate cache
      await this.invalidateCache(userId);

      return success;
    } catch (error) {
      throw new ModuleError(
        this.config.id,
        'UPDATE_ERROR',
        'Failed to update memory',
        error as Error,
      );
    }
  }

  async delete(userId: string, memoryId: string): Promise<boolean> {
    try {
      // Delete from module
      const success = await this.deleteFromModule(userId, memoryId);

      if (success) {
        // Remove from CMI
        if (this.cmi) {
          await this.cmi.deleteMemory(this.config.id, memoryId);
        }

        // Invalidate cache
        await this.invalidateCache(userId);
      }

      return success;
    } catch (error) {
      throw new ModuleError(
        this.config.id,
        'DELETE_ERROR',
        'Failed to delete memory',
        error as Error,
      );
    }
  }

  // ============= Module Info =============

  getConfig(): ModuleConfig {
    return this.config;
  }

  async getStats(userId: string): Promise<ModuleStats> {
    const stats = await this.calculateStats(userId);
    return stats;
  }

  // ============= Lifecycle =============

  async initialize(): Promise<void> {
    this.logger.info('Initializing module', { module: this.config.id });
    await this.onInitialize();
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down module', { module: this.config.id });
    await this.onShutdown();
  }

  // ============= Abstract Methods =============

  abstract getModuleInfo(): ModuleInfo;
  abstract processMetadata(
    content: string,
    metadata: Record<string, any>,
  ): Promise<Record<string, any>>;
  abstract formatSearchResult(memory: Memory): Memory;
  abstract searchByEmbedding(
    userId: string,
    embedding: number[],
    options?: SearchOptions,
  ): Promise<Memory[]>;

  // ============= Protected Methods =============

  protected abstract storeInModule(
    userId: string,
    content: string,
    embedding: number[],
    metadata: Record<string, any>,
  ): Promise<Memory>;

  protected abstract getFromModule(userId: string, memoryId: string): Promise<Memory | null>;

  protected abstract updateInModule(
    userId: string,
    memoryId: string,
    updates: Partial<Memory>,
  ): Promise<boolean>;

  protected abstract deleteFromModule(userId: string, memoryId: string): Promise<boolean>;

  protected abstract calculateStats(userId: string): Promise<ModuleStats>;

  // ============= Utility Methods =============

  protected extractTitle(content: string): string {
    // Extract first line or first 50 chars
    const firstLine = content.split('\n')[0];
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
  }

  protected async generateSummary(content: string): Promise<string> {
    // For now, return first 100 chars. In future, use AI summarization
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  }

  protected extractKeywords(content: string): string[] {
    // Simple keyword extraction - improve with NLP later
    const words = content.toLowerCase().split(/\W+/);
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
    ]);

    return Array.from(new Set(words.filter(word => word.length > 3 && !stopWords.has(word)))).slice(
      0,
      10,
    );
  }

  protected async updateAccessCounts(memoryIds: string[]): Promise<void> {
    // Update access counts in module table
    // Implementation depends on module schema
  }

  protected getCacheKey(userId: string, operation: string, ...params: any[]): string {
    return `${this.config.id}:${userId}:${operation}:${JSON.stringify(params)}`;
  }

  protected async invalidateCache(userId: string): Promise<void> {
    if (!this.redis) return;

    const pattern = `${this.config.id}:${userId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // ============= Health Check =============

  async healthCheck(): Promise<boolean> {
    try {
      // Check database connection
      await this.prisma.$queryRaw`SELECT 1`;

      // Check module-specific health
      return await this.checkModuleHealth();
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return false;
    }
  }

  protected async checkModuleHealth(): Promise<boolean> {
    // Override in subclasses for module-specific checks
    return true;
  }

  // ============= Events & Hooks =============

  async onConfigUpdate(newConfig: ModuleConfig): Promise<void> {
    this.config = newConfig;
    this.logger.info('Configuration updated', { module: this.config.id });
  }

  async onModuleConnect(moduleId: string, moduleInstance: BaseModule): Promise<void> {
    this.logger.info('Connected to module', { from: this.config.id, to: moduleId });
  }

  async onEvent(event: string, data: any): Promise<void> {
    this.logger.debug('Received event', { module: this.config.id, event, data });
  }

  // ============= Optional Lifecycle Hooks =============

  protected async onInitialize(): Promise<void> {
    // Override in modules that need initialization
  }

  protected async onShutdown(): Promise<void> {
    // Override in modules that need cleanup
  }

  async cleanup(): Promise<void> {
    await this.shutdown();
    await this.prisma.$disconnect();
  }
}
