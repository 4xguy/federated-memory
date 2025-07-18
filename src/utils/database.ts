import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

// Singleton pattern to prevent multiple connections
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Limit connection pool to prevent "too many clients" error
    // Railway's PostgreSQL typically allows 100 connections total
    // We'll use 20 to leave room for other services
    pool: {
      min: 2,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

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
    },
  ) {
    const id = randomUUID();
    const now = new Date();
    
    // Debug logging
    console.log('storeWithEmbedding called with:', {
      table,
      metadataType: typeof data.metadata,
      metadataStringified: JSON.stringify(data.metadata)
    });
    
    const result = await prisma.$queryRawUnsafe(`
      INSERT INTO "${table}" (
        id, "userId", content, embedding, metadata, "updatedAt", "lastAccessed"
      ) VALUES (
        $1, $2, $3, $4::vector, $5::jsonb, $6, $7
      )
      RETURNING id, "userId", content, metadata,
        "accessCount", "lastAccessed",
        "createdAt", "updatedAt"
    `, id, data.userId, data.content, data.embedding, JSON.stringify(data.metadata), now, now);
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
    },
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
      values.push(JSON.stringify(updates.metadata));
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
    } = {},
  ) {
    const limit = options.limit || 10;
    const minScore = options.minScore || 0.7;

    const filterClauses = [`"userId" = '${userId}'`];

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

    const query = `
      SELECT 
        id,
        "userId",
        content,
        metadata,
        "accessCount",
        "lastAccessed",
        "createdAt",
        "updatedAt",
        1 - (embedding <=> $1::vector) as score
      FROM "${table}"
      WHERE ${whereClause}
        AND 1 - (embedding <=> $1::vector) >= $2
      ORDER BY 
        1 - (embedding <=> $1::vector) DESC,
        "accessCount" DESC
      LIMIT $3
    `;
    
    return await prisma.$queryRawUnsafe(query, embedding, minScore, limit);
  },

  /**
   * Get memory with embedding
   */
  async getWithEmbedding(table: string, id: string, userId: string) {
    const result = await prisma.$queryRawUnsafe(`
      SELECT 
        id,
        "userId",
        content,
        metadata,
        "accessCount",
        "lastAccessed",
        "createdAt",
        "updatedAt"
      FROM "${table}"
      WHERE id = $1 AND "userId" = $2
    `, id, userId);

    return (result as any[])[0] || null;
  },
};
