import { OpenAI } from 'openai';
import { Logger } from '@/utils/logger';
import { Redis } from '@/utils/redis';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
  cacheEnabled?: boolean;
  batchSize?: number;
}

export class EmbeddingService {
  private openai: OpenAI;
  private redis: Redis | null;
  private logger: Logger;
  private prisma: PrismaClient;
  private defaultModel = 'text-embedding-ada-002';
  private batchSize = 100;
  private cacheEnabled = true;

  constructor(apiKey: string, options?: EmbeddingOptions) {
    this.openai = new OpenAI({ apiKey });
    this.logger = Logger.getInstance();
    this.redis = Redis.getInstance();
    this.prisma = new PrismaClient();

    if (options?.model) this.defaultModel = options.model;
    if (options?.batchSize) this.batchSize = options.batchSize;
    if (options?.cacheEnabled !== undefined) this.cacheEnabled = options.cacheEnabled;
  }

  /**
   * Generate embeddings for a single text
   */
  async generateEmbedding(text: string, dimensions?: number): Promise<number[]> {
    const cacheKey = this.getCacheKey(text, dimensions);

    // Check cache first
    if (this.cacheEnabled && this.redis) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.debug('Embedding cache hit', { cacheKey });
        return JSON.parse(cached);
      }
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.defaultModel,
        input: text,
      });

      const embedding = response.data[0].embedding;

      // Cache the result
      if (this.cacheEnabled && this.redis) {
        await this.redis.set(
          cacheKey,
          JSON.stringify(embedding),
          3600 * 24, // 24 hour TTL
        );
      }

      return embedding;
    } catch (error) {
      this.logger.error('Failed to generate embedding', { error, text });
      throw new Error(`Embedding generation failed: ${error}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batches
   */
  async generateBatchEmbeddings(texts: string[], dimensions?: number): Promise<number[][]> {
    const results: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    // Check cache for each text
    for (let i = 0; i < texts.length; i++) {
      const cacheKey = this.getCacheKey(texts[i], dimensions);
      if (this.cacheEnabled && this.redis) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          results[i] = JSON.parse(cached);
        } else {
          uncachedTexts.push(texts[i]);
          uncachedIndices.push(i);
        }
      } else {
        uncachedTexts.push(texts[i]);
        uncachedIndices.push(i);
      }
    }

    // Process uncached texts in batches
    for (let i = 0; i < uncachedTexts.length; i += this.batchSize) {
      const batch = uncachedTexts.slice(i, i + this.batchSize);

      try {
        const response = await this.openai.embeddings.create({
          model: this.defaultModel,
          input: batch,
        });

        // Store results and cache them
        for (let j = 0; j < response.data.length; j++) {
          const embedding = response.data[j].embedding;
          const originalIndex = uncachedIndices[i + j];
          const cacheKey = this.getCacheKey(texts[originalIndex], dimensions);

          results[originalIndex] = embedding;

          if (this.cacheEnabled && this.redis) {
            await this.redis.set(
              cacheKey,
              JSON.stringify(embedding),
              3600 * 24, // 24 hour TTL
            );
          }
        }
      } catch (error) {
        this.logger.error('Batch embedding generation failed', { error, batchIndex: i });
        throw new Error(`Batch embedding generation failed: ${error}`);
      }
    }

    return results;
  }

  /**
   * Generate compressed embeddings for CMI (512 dimensions)
   */
  async generateCompressedEmbedding(text: string): Promise<number[]> {
    const fullEmbedding = await this.generateEmbedding(text);
    return this.reduceDimensions(fullEmbedding, 512);
  }

  /**
   * Generate full embeddings for module storage (1536 dimensions)
   */
  async generateFullEmbedding(text: string): Promise<number[]> {
    return this.generateEmbedding(text);
  }

  /**
   * Reduce dimensionality of existing embedding using PCA-like approach
   * This is a simplified version - in production, consider using proper PCA
   */
  reduceDimensions(embedding: number[], targetDimensions: number): number[] {
    if (embedding.length <= targetDimensions) {
      return embedding;
    }

    // Simple averaging approach for dimension reduction
    const ratio = embedding.length / targetDimensions;
    const reduced: number[] = [];

    for (let i = 0; i < targetDimensions; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.floor((i + 1) * ratio);

      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += embedding[j];
      }

      reduced.push(sum / (end - start));
    }

    // Normalize the reduced embedding
    const magnitude = Math.sqrt(reduced.reduce((sum, val) => sum + val * val, 0));
    return reduced.map(val => val / magnitude);
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Find most similar embeddings from a list
   */
  findMostSimilar(
    queryEmbedding: number[],
    embeddings: Array<{ id: string; embedding: number[] }>,
    topK: number = 5,
  ): Array<{ id: string; similarity: number }> {
    const similarities = embeddings.map(item => ({
      id: item.id,
      similarity: this.cosineSimilarity(queryEmbedding, item.embedding),
    }));

    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  /**
   * Clear embedding cache
   */
  async clearCache(): Promise<void> {
    if (this.redis) {
      const keys = await this.redis.keys('embedding:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      this.logger.info('Embedding cache cleared', { count: keys.length });
    }
  }

  /**
   * Generate cache key for embeddings
   */
  private getCacheKey(text: string, dimensions?: number): string {
    const hash = crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);

    return `embedding:${this.defaultModel}:${dimensions || 'default'}:${hash}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Export singleton instance
let embeddingService: EmbeddingService | null = null;

// Mock embedding service for when OpenAI is not configured
class MockEmbeddingService {
  async generateFullEmbedding(text: string): Promise<number[]> {
    // Generate a deterministic mock embedding based on text hash
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array(1536).fill(0).map((_, i) => Math.sin(hash + i) * 0.1);
  }

  async generateCompressedEmbedding(text: string): Promise<number[]> {
    // Generate a deterministic mock compressed embedding
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array(512).fill(0).map((_, i) => Math.cos(hash + i) * 0.1);
  }

  async generateBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.generateFullEmbedding(text)));
  }

  async generateCompressedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.generateCompressedEmbedding(text)));
  }
}

export function getEmbeddingService(): EmbeddingService | MockEmbeddingService {
  if (!embeddingService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'sk-test') {
      Logger.getInstance().warn('OPENAI_API_KEY not configured - using mock embedding service');
      embeddingService = new MockEmbeddingService() as any;
    } else {
      embeddingService = new EmbeddingService(apiKey);
    }
  }
  return embeddingService;
}
