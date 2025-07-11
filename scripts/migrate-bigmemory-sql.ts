import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { ModuleLoader } from '../src/core/modules/loader.service';
import { ModuleRegistry } from '../src/core/modules/registry.service';
import { getCMIService } from '../src/core/cmi/index.service';
import { Logger } from '../src/utils/logger';
import { BaseModule } from '../src/core/modules/base.module';
import { ProgressBar } from './utils/progress';

interface MigrationConfig {
  sourceDatabaseUrl: string;
  targetDatabaseUrl: string;
  batchSize: number;
  preserveEmbeddings: boolean;
  dryRun: boolean;
  userMapping?: Record<string, string>;
}

interface MigrationStats {
  totalMemories: number;
  migratedMemories: number;
  failedMemories: number;
  totalRelations: number;
  migratedRelations: number;
  failedRelations: number;
  moduleBreakdown: Record<string, number>;
  errors: Array<{ type: string; message: string; data?: any }>;
}

interface BigMemoryRecord {
  id: string;
  userId: string;
  content: string;
  contentHash: string;
  embedding?: any;
  title?: string;
  summary?: string;
  tags: string[];
  source?: string;
  sourceMetadata: any;
  createdAt: Date;
  updatedAt: Date;
  accessedAt: Date;
  accessCount: number;
}

interface BigMemoryRelation {
  id: string;
  userId: string;
  sourceMemoryId: string;
  targetMemoryId: string;
  relationType: string;
  strength: number;
  metadata: any;
  createdAt: Date;
}

class BigMemoryMigrator {
  private sourcePrisma: PrismaClient;
  private targetPrisma: PrismaClient;
  private logger: Logger;
  private config: MigrationConfig;
  private stats: MigrationStats;
  private memoryIdMap: Map<string, { federatedId: string; module: string }> = new Map();
  private moduleRegistry: ModuleRegistry;
  private cmiService: ReturnType<typeof getCMIService>;

  constructor(config: MigrationConfig) {
    this.config = config;
    this.logger = Logger.getInstance();
    
    this.sourcePrisma = new PrismaClient({
      datasources: {
        db: { url: config.sourceDatabaseUrl }
      }
    });
    
    this.targetPrisma = new PrismaClient({
      datasources: {
        db: { url: config.targetDatabaseUrl }
      }
    });

    this.stats = {
      totalMemories: 0,
      migratedMemories: 0,
      failedMemories: 0,
      totalRelations: 0,
      migratedRelations: 0,
      failedRelations: 0,
      moduleBreakdown: {},
      errors: []
    };

    this.moduleRegistry = ModuleRegistry.getInstance();
    this.cmiService = getCMIService();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing migration...');
    
    await this.sourcePrisma.$connect();
    await this.targetPrisma.$connect();
    
    const moduleLoader = ModuleLoader.getInstance();
    await moduleLoader.loadAllModules();
    
    this.logger.info('Migration initialized successfully');
  }

  async migrate(): Promise<MigrationStats> {
    try {
      this.logger.info('Starting BigMemory to Federated Memory migration...');
      
      if (this.config.dryRun) {
        this.logger.warn('DRY RUN MODE - No data will be written');
      }

      await this.countMemories();
      await this.ensureUsers();
      await this.migrateMemories();
      await this.migrateRelationships();
      
      return this.stats;
    } catch (error) {
      this.logger.error('Migration failed', { error });
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async countMemories(): Promise<void> {
    const result = await this.sourcePrisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count 
      FROM memories 
      WHERE is_deleted = false
    `;
    
    this.stats.totalMemories = Number(result[0].count);
    this.logger.info(`Found ${this.stats.totalMemories} memories to migrate`);
  }

  private async ensureUsers(): Promise<void> {
    if (!this.config.userMapping) {
      this.logger.info('Creating user mapping...');
      
      const users = await this.sourcePrisma.$queryRaw<Array<{
        id: string;
        token: string;
        email: string | null;
        password: string | null;
        is_active: boolean;
        created_at: Date;
        updated_at: Date;
      }>>`
        SELECT id, token, email, password, is_active, created_at, updated_at
        FROM users
        WHERE is_active = true
      `;
      
      this.config.userMapping = {};
      
      for (const user of users) {
        try {
          // Check if user exists in target
          const existing = await this.targetPrisma.user.findUnique({
            where: { token: user.token }
          });
          
          if (existing) {
            this.config.userMapping[user.id] = existing.id;
            this.logger.info(`Mapped user ${user.email || user.id}`);
          } else if (!this.config.dryRun) {
            // Create new user
            const newUser = await this.targetPrisma.user.create({
              data: {
                token: user.token,
                email: user.email,
                name: user.email?.split('@')[0] || `User ${user.id.slice(0, 8)}`,
                passwordHash: user.password,
                isActive: user.is_active,
                createdAt: user.created_at,
                updatedAt: user.updated_at
              }
            });
            
            this.config.userMapping[user.id] = newUser.id;
            this.logger.info(`Created user ${user.email || user.id}`);
          }
        } catch (error) {
          this.logger.error(`Failed to map user ${user.id}`, { error });
        }
      }
    }
  }

  private async migrateMemories(): Promise<void> {
    const progressBar = new ProgressBar('Migrating memories', this.stats.totalMemories);
    
    let offset = 0;
    while (offset < this.stats.totalMemories) {
      const memories = await this.sourcePrisma.$queryRaw<BigMemoryRecord[]>`
        SELECT 
          id,
          user_id as "userId",
          content,
          content_hash as "contentHash",
          embedding::text as embedding,
          title,
          summary,
          tags,
          source,
          source_metadata as "sourceMetadata",
          created_at as "createdAt",
          updated_at as "updatedAt",
          accessed_at as "accessedAt",
          access_count as "accessCount"
        FROM memories
        WHERE is_deleted = false
        ORDER BY created_at ASC
        LIMIT ${this.config.batchSize}
        OFFSET ${offset}
      `;
      
      for (const memory of memories) {
        try {
          await this.migrateMemory(memory);
          this.stats.migratedMemories++;
          progressBar.update(this.stats.migratedMemories);
        } catch (error) {
          this.stats.failedMemories++;
          this.stats.errors.push({
            type: 'memory_migration',
            message: `Failed to migrate memory ${memory.id}`,
            data: { memoryId: memory.id, error: String(error) }
          });
        }
      }
      
      offset += this.config.batchSize;
    }
    
    progressBar.complete();
  }

  private async migrateMemory(memory: BigMemoryRecord): Promise<void> {
    const targetModule = this.determineTargetModule(memory);
    const module = await this.moduleRegistry.getModule(targetModule);
    
    if (!module) {
      throw new Error(`Module ${targetModule} not found`);
    }
    
    const userId = this.config.userMapping?.[memory.userId] || memory.userId;
    const metadata = this.transformMetadata(memory, targetModule);
    
    if (this.config.dryRun) {
      this.logger.debug(`Would migrate to ${targetModule}`, { 
        memoryId: memory.id,
        title: memory.title 
      });
      // Update stats even in dry run
      this.stats.moduleBreakdown[targetModule] = 
        (this.stats.moduleBreakdown[targetModule] || 0) + 1;
      return;
    }
    
    // Store the memory
    let federatedMemory;
    if (this.config.preserveEmbeddings && memory.embedding) {
      // Direct database insert with existing embedding
      const embeddingArray = this.parseEmbedding(memory.embedding);
      federatedMemory = await this.storeWithEmbedding(
        module,
        userId,
        memory.content,
        embeddingArray,
        metadata
      );
    } else {
      // Use module's store method (generates new embedding)
      federatedMemory = await module.store(userId, memory.content, metadata);
    }
    
    this.memoryIdMap.set(memory.id, {
      federatedId: federatedMemory.id,
      module: targetModule
    });
    
    this.stats.moduleBreakdown[targetModule] = 
      (this.stats.moduleBreakdown[targetModule] || 0) + 1;
  }

  private parseEmbedding(embedding: any): number[] {
    if (Array.isArray(embedding)) {
      return embedding;
    }
    
    if (typeof embedding === 'string') {
      // PostgreSQL array format: [1,2,3] or {1,2,3}
      const cleaned = embedding.replace(/[\[\]{}]/g, '');
      return cleaned.split(',').map(Number);
    }
    
    return [];
  }

  private async storeWithEmbedding(
    module: BaseModule,
    userId: string,
    content: string,
    embedding: number[],
    metadata: Record<string, any>
  ): Promise<any> {
    const tableName = (module as any).config.tableName;
    
    // Dynamic table names require $queryRawUnsafe
    const result = await this.targetPrisma.$queryRawUnsafe(`
      INSERT INTO "${tableName}" (
        id, "userId", content, embedding, metadata,
        "createdAt", "updatedAt", "accessCount", "lastAccessed"
      ) VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3::vector,
        $4::jsonb,
        $5,
        NOW(),
        $6,
        NOW()
      )
      RETURNING id
    `, 
      userId,
      content,
      `[${embedding.join(',')}]`,
      JSON.stringify(metadata),
      metadata.original_created_at || new Date(),
      metadata.access_count || 0
    );
    
    return { id: (result as any)[0].id };
  }

  private determineTargetModule(memory: BigMemoryRecord): string {
    const metadata = memory.sourceMetadata || {};
    const tags = memory.tags || [];
    const content = memory.content.toLowerCase();
    
    // Check metadata type
    if (metadata.type === 'project' || metadata.type === 'task') {
      return 'work';
    }
    
    // Check tags
    for (const tag of tags) {
      if (tag.includes('project') || tag.includes('task') || tag.includes('meeting')) {
        return 'work';
      }
      if (tag.includes('personal') || tag.includes('diary')) {
        return 'personal';
      }
      if (tag.includes('learn') || tag.includes('study')) {
        return 'learning';
      }
      if (tag.includes('code') || tag.includes('technical')) {
        return 'technical';
      }
      if (tag.includes('email') || tag.includes('message')) {
        return 'communication';
      }
      if (tag.includes('creative') || tag.includes('idea')) {
        return 'creative';
      }
    }
    
    // Content analysis
    if (/project|task|meeting|deadline/.test(content)) return 'work';
    if (/personal|family|health|diary/.test(content)) return 'personal';
    if (/learn|study|course|tutorial/.test(content)) return 'learning';
    if (/code|debug|api|function|error/.test(content)) return 'technical';
    if (/email|message|chat|call/.test(content)) return 'communication';
    if (/idea|creative|design|story/.test(content)) return 'creative';
    
    return 'personal'; // default
  }

  private transformMetadata(memory: BigMemoryRecord, targetModule: string): Record<string, any> {
    const base = {
      migrated_from: 'bigmemory',
      original_id: memory.id,
      original_created_at: memory.createdAt,
      original_tags: memory.tags,
      access_count: memory.accessCount,
      title: memory.title,
      summary: memory.summary
    };
    
    const sourceMetadata = memory.sourceMetadata || {};
    
    switch (targetModule) {
      case 'work':
        if (sourceMetadata.type === 'project') {
          return {
            ...base,
            category: 'project',
            project_name: memory.title || sourceMetadata.name,
            status: sourceMetadata.status || 'active',
            team_members: sourceMetadata.team || [],
            deadline: sourceMetadata.dueDate,
            owner: sourceMetadata.owner
          };
        } else if (sourceMetadata.type === 'task') {
          return {
            ...base,
            category: 'task',
            status: sourceMetadata.status || 'active',
            priority: sourceMetadata.priority || 'medium',
            assignee: sourceMetadata.assignee,
            deadline: sourceMetadata.dueDate,
            project_name: sourceMetadata.projectName
          };
        }
        return { ...base, category: 'task' };
        
      default:
        return { ...base, ...sourceMetadata };
    }
  }

  private async migrateRelationships(): Promise<void> {
    const relations = await this.sourcePrisma.$queryRaw<BigMemoryRelation[]>`
      SELECT 
        id,
        user_id as "userId",
        source_memory_id as "sourceMemoryId",
        target_memory_id as "targetMemoryId",
        relation_type as "relationType",
        strength,
        metadata,
        created_at as "createdAt"
      FROM memory_relations
    `;
    
    this.stats.totalRelations = relations.length;
    const progressBar = new ProgressBar('Migrating relationships', relations.length);
    
    for (const relation of relations) {
      try {
        const source = this.memoryIdMap.get(relation.sourceMemoryId);
        const target = this.memoryIdMap.get(relation.targetMemoryId);
        
        if (!source || !target) {
          this.logger.debug('Skipping relation - memory not migrated', {
            sourceId: relation.sourceMemoryId,
            targetId: relation.targetMemoryId
          });
          continue;
        }
        
        if (!this.config.dryRun) {
          const userId = this.config.userMapping?.[relation.userId] || relation.userId;
          
          await this.targetPrisma.memoryRelationship.create({
            data: {
              userId,
              sourceModule: source.module,
              sourceMemoryId: source.federatedId,
              targetModule: target.module,
              targetMemoryId: target.federatedId,
              relationshipType: relation.relationType,
              strength: relation.strength,
              metadata: relation.metadata || {},
              createdAt: relation.createdAt
            }
          });
        }
        
        this.stats.migratedRelations++;
        progressBar.update(this.stats.migratedRelations);
      } catch (error) {
        this.stats.failedRelations++;
        this.stats.errors.push({
          type: 'relation_migration',
          message: `Failed to migrate relation ${relation.id}`,
          data: { error: String(error) }
        });
      }
    }
    
    progressBar.complete();
  }

  private async cleanup(): Promise<void> {
    await this.sourcePrisma.$disconnect();
    await this.targetPrisma.$disconnect();
  }

  printReport(): void {
    console.log('\n=== Migration Report ===\n');
    console.log(`Total Memories: ${this.stats.totalMemories}`);
    console.log(`Migrated Successfully: ${this.stats.migratedMemories}`);
    console.log(`Failed: ${this.stats.failedMemories}`);
    console.log(`\nTotal Relations: ${this.stats.totalRelations}`);
    console.log(`Migrated Relations: ${this.stats.migratedRelations}`);
    console.log(`Failed Relations: ${this.stats.failedRelations}`);
    
    console.log('\n=== Module Breakdown ===');
    for (const [module, count] of Object.entries(this.stats.moduleBreakdown)) {
      console.log(`${module}: ${count} memories`);
    }
    
    if (this.stats.errors.length > 0) {
      console.log(`\n=== Errors (${this.stats.errors.length}) ===`);
      for (const error of this.stats.errors.slice(0, 10)) {
        console.log(`- ${error.type}: ${error.message}`);
      }
      if (this.stats.errors.length > 10) {
        console.log(`... and ${this.stats.errors.length - 10} more errors`);
      }
    }
    
    console.log('\n======================\n');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
BigMemory to Federated Memory Migration Tool

Usage: npm run migrate:bigmemory [options]

Options:
  --source-db <url>     Source BigMemory database URL
  --target-db <url>     Target Federated Memory database URL
  --batch-size <n>      Number of memories to process at once (default: 100)
  --preserve-embeddings Preserve existing embeddings
  --dry-run            Run without making changes
  --help               Show this help

Environment Variables:
  SOURCE_DATABASE_URL   BigMemory database connection
  DATABASE_URL         Federated Memory database connection
`);
    process.exit(0);
  }
  
  const getArg = (name: string, defaultValue?: string): string | undefined => {
    const index = args.indexOf(name);
    if (index >= 0 && index + 1 < args.length) {
      return args[index + 1];
    }
    return defaultValue;
  };
  
  const config: MigrationConfig = {
    sourceDatabaseUrl: getArg('--source-db') || process.env.SOURCE_DATABASE_URL || '',
    targetDatabaseUrl: getArg('--target-db') || process.env.DATABASE_URL || '',
    batchSize: parseInt(getArg('--batch-size', '100') || '100'),
    preserveEmbeddings: args.includes('--preserve-embeddings'),
    dryRun: args.includes('--dry-run')
  };
  
  if (!config.sourceDatabaseUrl || !config.targetDatabaseUrl) {
    console.error('Error: Database URLs required');
    console.error('Set SOURCE_DATABASE_URL and DATABASE_URL or use --source-db and --target-db');
    process.exit(1);
  }
  
  const migrator = new BigMemoryMigrator(config);
  
  try {
    await migrator.initialize();
    const stats = await migrator.migrate();
    migrator.printReport();
    
    if (stats.failedMemories > 0 || stats.failedRelations > 0) {
      process.exit(1);
    }
    
    // Ensure clean exit
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { BigMemoryMigrator, MigrationConfig, MigrationStats };