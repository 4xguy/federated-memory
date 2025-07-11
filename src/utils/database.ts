import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

export const prisma = new PrismaClient();

/**
 * Helper functions for working with pgvector embeddings
 */
export const vectorDb = {
  /**
   * Store a memory with embeddings using raw SQL
   */
  async storeWithEmbedding(
    table: string,
    data: {
      userId: string;
      content: string;
      embedding: number[];
      metadata: any;
    }
  ) {
    const id = randomUUID();
    const now = new Date();
    const result = await prisma.$queryRaw`
      INSERT INTO ${Prisma.sql([table])} (
        id, "userId", content, embedding, metadata, "updatedAt"
      ) VALUES (
        ${id},
        ${data.userId},
        ${data.content},
        ${data.embedding}::vector,
        ${data.metadata}::jsonb,
        ${now}
      )
      RETURNING id, "userId", content, metadata,
        "accessCount", "lastAccessed",
        "createdAt", "updatedAt"
    `;
    return (result as any[])[0];
  },

  /**
   * Update a memory with new embedding
   */
  async updateWithEmbedding(
    table: string,
    id: string,
    userId: string,
    updates: {
      content?: string;
      embedding?: number[];
      metadata?: any;
    }
  ) {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 3; // Start after id and userId

    if (updates.content !== undefined) {
      setClauses.push(`content = $${paramIndex}`);
      values.push(updates.content);
      paramIndex++;
    }

    if (updates.embedding !== undefined) {
      setClauses.push(`embedding = $${paramIndex}::vector`);
      values.push(updates.embedding);
      paramIndex++;
    }

    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex}::jsonb`);
      values.push(updates.metadata);
      paramIndex++;
    }

    setClauses.push('"updatedAt" = NOW()');

    const query = `
      UPDATE ${table}
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND "userId" = $2
      RETURNING id
    `;

    const result = await prisma.$executeRawUnsafe(query, id, userId, ...values);
    return result > 0;
  },

  /**
   * Search by embedding similarity
   */
  async searchByEmbedding(
    table: string,
    userId: string,
    embedding: number[],
    options: {
      limit?: number;
      minScore?: number;
      filters?: Record<string, any>;
    } = {}
  ) {
    const limit = options.limit || 10;
    const minScore = options.minScore || 0.7;

    let filterClauses = [`"userId" = '${userId}'`];
    
    // Add metadata filters
    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        if (Array.isArray(value)) {
          // For array values, use the ?| operator
          const arrayStr = `ARRAY[${value.map(v => `'${v}'`).join(',')}]`;
          filterClauses.push(`metadata->'${key}' ?| ${arrayStr}`);
        } else {
          // For single values, quote them properly
          filterClauses.push(`metadata->>'${key}' = '${value}'`);
        }
      }
    }

    const whereClause = filterClauses.join(' AND ');

    return await prisma.$queryRaw`
      SELECT 
        id,
        "userId",
        content,
        metadata,
        "accessCount",
        "lastAccessed",
        "createdAt",
        "updatedAt",
        1 - (embedding <=> ${embedding}::vector) as score
      FROM ${Prisma.sql([table])}
      WHERE ${Prisma.raw(whereClause)}
        AND 1 - (embedding <=> ${embedding}::vector) >= ${minScore}
      ORDER BY 
        1 - (embedding <=> ${embedding}::vector) DESC,
        "accessCount" DESC
      LIMIT ${limit}
    `;
  },

  /**
   * Get memory with embedding
   */
  async getWithEmbedding(
    table: string,
    id: string,
    userId: string
  ) {
    const result = await prisma.$queryRaw`
      SELECT 
        id,
        "userId",
        content,
        metadata,
        "accessCount",
        "lastAccessed",
        "createdAt",
        "updatedAt"
      FROM ${Prisma.sql([table])}
      WHERE id = ${id} AND "userId" = ${userId}
    `;
    
    return (result as any[])[0] || null;
  }
};