import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import type { PrismaClient as PrismaClientType } from '@prisma/client';
import { ModuleLoader } from '../src/core/modules/loader.service';
import { ModuleRegistry } from '../src/core/modules/registry.service';
import { getCMIService } from '../src/core/cmi/index.service';
import { Logger } from '../src/utils/logger';
import { BaseModule } from '../src/core/modules/base.module';
import crypto from 'crypto';
import { ProgressBar } from './utils/progress';

interface MigrationConfig {
  sourceDatabaseUrl: string;
  targetDatabaseUrl: string;
  batchSize: number;
  preserveEmbeddings: boolean;
  dryRun: boolean;
  userMapping?: Record<string, string>; // Map BigMemory userId to Federated userId
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

interface MemoryMigrationMapping {
  bigMemoryId: string;
  federatedMemoryId: string;
  module: string;
}

class BigMemoryMigrator {
  private sourcePrisma: PrismaClientType;
  private targetPrisma: PrismaClientType;
  private logger: Logger;
  private config: MigrationConfig;
  private stats: MigrationStats;
  private memoryIdMap: Map<string, MemoryMigrationMapping> = new Map();
  private moduleRegistry: ModuleRegistry;
  private cmiService: ReturnType<typeof getCMIService>;

  constructor(config: MigrationConfig) {
    this.config = config;
    this.logger = Logger.getInstance();
    
    // Initialize database connections
    // For source database, we'll need to dynamically load the BigMemory prisma client
    // For now, we'll use the same client but point to different DBs
    this.sourcePrisma = new PrismaClient({
      datasources: {
        db: {
          url: config.sourceDatabaseUrl
        }
      }
    });
    
    this.targetPrisma = new PrismaClient({
      datasources: {
        db: {
          url: config.targetDatabaseUrl
        }
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
    
    // Test connections
    await this.sourcePrisma.$connect();
    await this.targetPrisma.$connect();
    
    // Load all modules
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

      // Step 1: Count total memories
      await this.countMemories();
      
      // Step 2: Migrate users if needed
      await this.ensureUsers();
      
      // Step 3: Migrate memories in batches
      await this.migrateMemories();
      
      // Step 4: Migrate relationships
      await this.migrateRelationships();
      
      // Step 5: Migrate categories if applicable
      await this.migrateCategories();
      
      // Step 6: Update CMI index
      if (!this.config.dryRun) {
        await this.updateCMIIndex();
      }
      
      return this.stats;
    } catch (error) {
      this.logger.error('Migration failed', { error });
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async countMemories(): Promise<void> {
    const count = await this.sourcePrisma.memory.count({
      where: { isDeleted: false }
    });
    this.stats.totalMemories = count;
    this.logger.info(`Found ${count} memories to migrate`);
  }

  private async ensureUsers(): Promise<void> {
    if (!this.config.userMapping) {
      this.logger.info('No user mapping provided, will attempt to match by token');
      
      // Get unique users from BigMemory
      const users = await this.sourcePrisma.user.findMany({
        where: { isActive: true }
      });
      
      this.config.userMapping = {};
      
      for (const user of users) {
        // Try to find matching user in Federated Memory by token
        const federatedUser = await this.targetPrisma.user.findUnique({
          where: { token: user.token }
        });
        
        if (federatedUser) {
          this.config.userMapping[user.id] = federatedUser.id;
          this.logger.info(`Mapped user ${user.email || user.id} to federated user`);
        } else if (!this.config.dryRun) {
          // Create user if not exists
          const newUser = await this.targetPrisma.user.create({
            data: {
              id: user.id, // Preserve original ID if possible
              token: user.token,
              email: user.email,
              name: user.email?.split('@')[0] || `User ${user.id.slice(0, 8)}`,
              passwordHash: user.password,
              isActive: user.isActive,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt
            }
          });
          
          this.config.userMapping[user.id] = newUser.id;
          this.logger.info(`Created new federated user for ${user.email || user.id}`);
        }
      }
    }
  }

  private async migrateMemories(): Promise<void> {
    const progressBar = new ProgressBar('Migrating memories', this.stats.totalMemories);
    
    let offset = 0;
    while (offset < this.stats.totalMemories) {
      const memories = await this.sourcePrisma.memory.findMany({
        where: { isDeleted: false },
        skip: offset,
        take: this.config.batchSize,
        orderBy: { createdAt: 'asc' }
      });
      
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
            data: { memoryId: memory.id, error: error instanceof Error ? error.message : String(error) }
          });
          this.logger.error('Failed to migrate memory', { memoryId: memory.id, error });
        }
      }
      
      offset += this.config.batchSize;
    }
    
    progressBar.complete();
  }

  private async migrateMemory(memory: any): Promise<void> {
    // Determine target module based on metadata and content
    const targetModule = this.determineTargetModule(memory);
    
    // Get module instance
    const module = await this.moduleRegistry.getModule(targetModule);
    if (!module) {
      throw new Error(`Module ${targetModule} not found`);
    }
    
    // Map user ID
    const userId = this.config.userMapping?.[memory.userId] || memory.userId;
    
    // Prepare metadata for the target module
    const metadata = this.transformMetadata(memory, targetModule);
    
    if (this.config.dryRun) {
      this.logger.debug('Would migrate memory', { 
        memoryId: memory.id, 
        targetModule, 
        userId 
      });
      return;
    }
    
    // Store in the appropriate module
    let federatedMemory;
    if (this.config.preserveEmbeddings && memory.embedding) {
      // Use existing embedding
      federatedMemory = await this.storeWithExistingEmbedding(
        module,
        userId,
        memory.content,
        memory.embedding,
        metadata
      );
    } else {
      // Let the module generate new embedding
      federatedMemory = await module.store(userId, memory.content, metadata);
    }
    
    // Store mapping for relationship migration
    this.memoryIdMap.set(memory.id, {
      bigMemoryId: memory.id,
      federatedMemoryId: federatedMemory.id,
      module: targetModule
    });
    
    // Update module breakdown stats
    this.stats.moduleBreakdown[targetModule] = 
      (this.stats.moduleBreakdown[targetModule] || 0) + 1;
  }

  private determineTargetModule(memory: any): string {
    const metadata = memory.sourceMetadata || {};
    const tags = memory.tags || [];
    const content = memory.content.toLowerCase();
    
    // Check for explicit type in metadata
    if (metadata.type === 'project' || metadata.type === 'task') {
      return 'work';
    }
    
    // Check for category system from BigMemory
    if (metadata.category) {
      const categoryMapping: Record<string, string> = {
        'Personal': 'personal',
        'Work': 'work',
        'Learning': 'learning',
        'Technical': 'technical',
        'Communication': 'communication',
        'Creative': 'creative'
      };
      
      const mappedModule = categoryMapping[metadata.category];
      if (mappedModule) return mappedModule;
    }
    
    // Check tags for hints
    for (const tag of tags) {
      if (tag.includes('project') || tag.includes('task') || tag.includes('meeting')) {
        return 'work';
      }
      if (tag.includes('personal') || tag.includes('diary') || tag.includes('journal')) {
        return 'personal';
      }
      if (tag.includes('learn') || tag.includes('study') || tag.includes('course')) {
        return 'learning';
      }
      if (tag.includes('code') || tag.includes('technical') || tag.includes('debug')) {
        return 'technical';
      }
      if (tag.includes('email') || tag.includes('message') || tag.includes('chat')) {
        return 'communication';
      }
      if (tag.includes('idea') || tag.includes('creative') || tag.includes('design')) {
        return 'creative';
      }
    }
    
    // Content-based classification
    if (/\b(project|task|meeting|deadline|milestone)\b/i.test(content)) {
      return 'work';
    }
    if (/\b(personal|family|health|diary|journal)\b/i.test(content)) {
      return 'personal';
    }
    if (/\b(learn|study|course|tutorial|lesson)\b/i.test(content)) {
      return 'learning';
    }
    if (/\b(code|debug|api|function|class|error|bug)\b/i.test(content)) {
      return 'technical';
    }
    if (/\b(email|message|chat|call|meeting notes)\b/i.test(content)) {
      return 'communication';
    }
    if (/\b(idea|creative|design|story|art)\b/i.test(content)) {
      return 'creative';
    }
    
    // Default to personal if unclear
    return 'personal';
  }

  private transformMetadata(memory: any, targetModule: string): Record<string, any> {
    const sourceMetadata = memory.sourceMetadata || {};
    const baseMetadata = {
      migrated_from: 'bigmemory',
      original_id: memory.id,
      original_created_at: memory.createdAt,
      original_tags: memory.tags,
      access_count: memory.accessCount,
      title: memory.title,
      summary: memory.summary
    };
    
    // Module-specific transformations
    switch (targetModule) {
      case 'work':
        return {
          ...baseMetadata,
          ...this.transformWorkMetadata(sourceMetadata, memory)
        };
      case 'personal':
        return {
          ...baseMetadata,
          ...this.transformPersonalMetadata(sourceMetadata, memory)
        };
      case 'technical':
        return {
          ...baseMetadata,
          ...this.transformTechnicalMetadata(sourceMetadata, memory)
        };
      case 'learning':
        return {
          ...baseMetadata,
          ...this.transformLearningMetadata(sourceMetadata, memory)
        };
      case 'communication':
        return {
          ...baseMetadata,
          ...this.transformCommunicationMetadata(sourceMetadata, memory)
        };
      case 'creative':
        return {
          ...baseMetadata,
          ...this.transformCreativeMetadata(sourceMetadata, memory)
        };
      default:
        return { ...baseMetadata, ...sourceMetadata };
    }
  }

  private transformWorkMetadata(sourceMetadata: any, memory: any): any {
    const metadata: any = {};
    
    // Handle project/task metadata
    if (sourceMetadata.type === 'project') {
      metadata.category = 'project';
      metadata.project_name = memory.title || sourceMetadata.name;
      metadata.status = sourceMetadata.status || 'active';
      metadata.team_members = sourceMetadata.team || [];
      metadata.deadline = sourceMetadata.dueDate;
      metadata.owner = sourceMetadata.owner;
    } else if (sourceMetadata.type === 'task') {
      metadata.category = 'task';
      metadata.status = sourceMetadata.status || 'active';
      metadata.priority = sourceMetadata.priority || 'medium';
      metadata.assignee = sourceMetadata.assignee;
      metadata.deadline = sourceMetadata.dueDate;
      metadata.project_name = sourceMetadata.projectName;
    } else {
      // Try to infer from content
      metadata.category = this.inferWorkCategory(memory.content);
    }
    
    // Extract tags that are relevant to work module
    metadata.tags = memory.tags?.filter((tag: string) => 
      tag.includes('project') || 
      tag.includes('task') || 
      tag.includes('meeting') ||
      tag.includes('deadline')
    ) || [];
    
    return metadata;
  }

  private transformPersonalMetadata(sourceMetadata: any, memory: any): any {
    return {
      category: sourceMetadata.category || 'general',
      mood: sourceMetadata.mood,
      people_mentioned: this.extractPeopleMentioned(memory.content),
      location: sourceMetadata.location,
      tags: memory.tags || []
    };
  }

  private transformTechnicalMetadata(sourceMetadata: any, memory: any): any {
    return {
      category: sourceMetadata.category || 'general',
      language: sourceMetadata.language || this.detectProgrammingLanguage(memory.content),
      framework: sourceMetadata.framework,
      error_type: sourceMetadata.errorType,
      solution_found: sourceMetadata.solutionFound,
      tags: memory.tags || []
    };
  }

  private transformLearningMetadata(sourceMetadata: any, memory: any): any {
    return {
      category: sourceMetadata.category || 'note',
      topic: sourceMetadata.topic || memory.title,
      source: sourceMetadata.source || memory.source,
      understanding_level: sourceMetadata.understandingLevel,
      tags: memory.tags || []
    };
  }

  private transformCommunicationMetadata(sourceMetadata: any, memory: any): any {
    return {
      category: sourceMetadata.category || 'message',
      channel: sourceMetadata.channel,
      participants: sourceMetadata.participants || [],
      thread_id: sourceMetadata.threadId,
      tags: memory.tags || []
    };
  }

  private transformCreativeMetadata(sourceMetadata: any, memory: any): any {
    return {
      category: sourceMetadata.category || 'idea',
      medium: sourceMetadata.medium,
      inspiration: sourceMetadata.inspiration,
      status: sourceMetadata.status || 'concept',
      tags: memory.tags || []
    };
  }

  private async storeWithExistingEmbedding(
    module: BaseModule,
    userId: string,
    content: string,
    embedding: any,
    metadata: Record<string, any>
  ): Promise<any> {
    // Convert embedding format if needed
    const embeddingArray = Array.isArray(embedding) ? embedding : JSON.parse(embedding);
    
    // Use module's internal storage method directly
    const storeMethod = (module as any).storeInModule;
    if (typeof storeMethod === 'function') {
      return await storeMethod.call(module, userId, content, embeddingArray, metadata);
    } else {
      // Fallback to regular store (will regenerate embedding)
      return await module.store(userId, content, metadata);
    }
  }

  private async migrateRelationships(): Promise<void> {
    this.logger.info('Migrating memory relationships...');
    
    const relations = await this.sourcePrisma.memoryRelation.findMany();
    this.stats.totalRelations = relations.length;
    
    const progressBar = new ProgressBar('Migrating relationships', relations.length);
    
    for (const relation of relations) {
      try {
        await this.migrateRelation(relation);
        this.stats.migratedRelations++;
        progressBar.update(this.stats.migratedRelations);
      } catch (error) {
        this.stats.failedRelations++;
        this.stats.errors.push({
          type: 'relation_migration',
          message: `Failed to migrate relation ${relation.id}`,
          data: { relationId: relation.id, error: error instanceof Error ? error.message : String(error) }
        });
      }
    }
    
    progressBar.complete();
  }

  private async migrateRelation(relation: any): Promise<void> {
    const sourceMapping = this.memoryIdMap.get(relation.sourceMemoryId);
    const targetMapping = this.memoryIdMap.get(relation.targetMemoryId);
    
    if (!sourceMapping || !targetMapping) {
      this.logger.warn('Skipping relation - memory not migrated', {
        relationId: relation.id,
        sourceMemoryId: relation.sourceMemoryId,
        targetMemoryId: relation.targetMemoryId
      });
      return;
    }
    
    if (this.config.dryRun) {
      this.logger.debug('Would migrate relation', { relationId: relation.id });
      return;
    }
    
    const userId = this.config.userMapping?.[relation.userId] || relation.userId;
    
    await this.targetPrisma.memoryRelationship.create({
      data: {
        userId,
        sourceModule: sourceMapping.module,
        sourceMemoryId: sourceMapping.federatedMemoryId,
        targetModule: targetMapping.module,
        targetMemoryId: targetMapping.federatedMemoryId,
        relationshipType: relation.relationType,
        strength: relation.strength,
        metadata: relation.metadata,
        createdAt: relation.createdAt
      }
    });
  }

  private async migrateCategories(): Promise<void> {
    // Check if BigMemory has categories
    const hasCategories = await this.sourcePrisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'memory_categories'
      ) as exists
    `;
    
    if (!hasCategories) {
      this.logger.info('No categories table found in BigMemory, skipping category migration');
      return;
    }
    
    // Migrate categories if they exist
    this.logger.info('Categories migration would be implemented here');
    // Implementation would go here if categories exist
  }

  private async updateCMIIndex(): Promise<void> {
    this.logger.info('Updating CMI index for migrated memories...');
    
    // The CMI should have been updated during the migration process
    // This is just a verification step
    const indexCount = await this.targetPrisma.memoryIndex.count();
    this.logger.info(`CMI index contains ${indexCount} entries`);
  }

  private async cleanup(): Promise<void> {
    await this.sourcePrisma.$disconnect();
    await this.targetPrisma.$disconnect();
  }

  // Helper methods
  private inferWorkCategory(content: string): string {
    const lowerContent = content.toLowerCase();
    
    if (/meeting|standup|discussion/.test(lowerContent)) return 'meeting';
    if (/task|todo|action item/.test(lowerContent)) return 'task';
    if (/project|initiative|milestone/.test(lowerContent)) return 'project';
    if (/document|spec|requirements/.test(lowerContent)) return 'documentation';
    if (/email|slack|message/.test(lowerContent)) return 'communication';
    if (/plan|strategy|roadmap/.test(lowerContent)) return 'planning';
    
    return 'task'; // default
  }

  private extractPeopleMentioned(content: string): string[] {
    const people: string[] = [];
    
    // Look for @mentions
    const mentions = content.match(/@[a-zA-Z]+/g) || [];
    people.push(...mentions.map(m => m.substring(1)));
    
    // Look for names (simple pattern)
    const namePattern = /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g;
    const names = content.match(namePattern) || [];
    people.push(...names);
    
    return [...new Set(people)];
  }

  private detectProgrammingLanguage(content: string): string | undefined {
    const languagePatterns: Record<string, RegExp> = {
      javascript: /\b(const|let|var|function|=>|async|await)\b/,
      typescript: /\b(interface|type|enum|implements|extends)\b/,
      python: /\b(def|import|from|class|self|pip|django)\b/,
      java: /\b(public|private|class|void|static|final)\b/,
      rust: /\b(fn|let mut|impl|trait|match|Option|Result)\b/,
      go: /\b(func|package|import|defer|goroutine)\b/
    };
    
    for (const [language, pattern] of Object.entries(languagePatterns)) {
      if (pattern.test(content)) {
        return language;
      }
    }
    
    return undefined;
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
  --source-db <url>     Source BigMemory database URL (or use SOURCE_DATABASE_URL env)
  --target-db <url>     Target Federated Memory database URL (or use DATABASE_URL env)
  --batch-size <n>      Number of memories to process at once (default: 100)
  --preserve-embeddings Preserve existing embeddings instead of regenerating
  --dry-run            Run without making any changes
  --user-map <file>    JSON file mapping BigMemory userIds to Federated userIds
  --help               Show this help message

Environment Variables:
  SOURCE_DATABASE_URL   BigMemory database connection string
  DATABASE_URL         Federated Memory database connection string

Examples:
  # Dry run to see what would be migrated
  npm run migrate:bigmemory --dry-run
  
  # Full migration preserving embeddings
  npm run migrate:bigmemory --preserve-embeddings
  
  # Migration with custom batch size
  npm run migrate:bigmemory --batch-size 500
`);
    process.exit(0);
  }
  
  // Parse arguments
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
  
  // Load user mapping if provided
  const userMapFile = getArg('--user-map');
  if (userMapFile) {
    const fs = await import('fs/promises');
    const userMapData = await fs.readFile(userMapFile, 'utf-8');
    config.userMapping = JSON.parse(userMapData);
  }
  
  // Validate configuration
  if (!config.sourceDatabaseUrl) {
    console.error('Error: Source database URL is required');
    console.error('Set SOURCE_DATABASE_URL env variable or use --source-db option');
    process.exit(1);
  }
  
  if (!config.targetDatabaseUrl) {
    console.error('Error: Target database URL is required');
    console.error('Set DATABASE_URL env variable or use --target-db option');
    process.exit(1);
  }
  
  // Run migration
  const migrator = new BigMemoryMigrator(config);
  
  try {
    await migrator.initialize();
    const stats = await migrator.migrate();
    migrator.printReport();
    
    if (stats.failedMemories > 0 || stats.failedRelations > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { BigMemoryMigrator, MigrationConfig, MigrationStats };