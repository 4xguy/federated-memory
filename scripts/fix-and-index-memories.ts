import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getCMIService } from '../src/core/cmi/index.service';
import { ModuleLoader } from '../src/core/modules/loader.service';
import { ModuleRegistry } from '../src/core/modules/registry.service';
import { Logger } from '../src/utils/logger';

const prisma = new PrismaClient();
const logger = Logger.getInstance();

async function fixAndIndexMemories() {
  console.log('Fixing user issues and indexing memories...\n');
  
  try {
    // Initialize modules
    const moduleLoader = ModuleLoader.getInstance();
    await moduleLoader.loadAllModules();
    
    const cmiService = getCMIService();
    const moduleRegistry = ModuleRegistry.getInstance();
    
    // First, check for orphaned memories (memories with non-existent users)
    console.log('Step 1: Finding orphaned memories...');
    const modules = [
      'technical_memories',
      'personal_memories',
      'work_memories',
      'learning_memories',
      'communication_memories',
      'creative_memories'
    ];
    
    const orphanedUserIds = new Set<string>();
    
    for (const tableName of modules) {
      const orphaned = await prisma.$queryRawUnsafe<Array<{ userId: string; count: bigint }>>`
        SELECT DISTINCT m."userId", COUNT(*) as count
        FROM "${tableName}" m
        LEFT JOIN users u ON m."userId" = u.id
        WHERE u.id IS NULL
        GROUP BY m."userId"
      `;
      
      orphaned.forEach(row => {
        orphanedUserIds.add(row.userId);
        console.log(`  Found ${row.count} orphaned memories in ${tableName} for user ${row.userId}`);
      });
    }
    
    // Create placeholder users for orphaned memories
    if (orphanedUserIds.size > 0) {
      console.log('\nStep 2: Creating placeholder users for orphaned memories...');
      
      for (const userId of orphanedUserIds) {
        try {
          await prisma.user.create({
            data: {
              id: userId,
              email: `migrated-${userId.substring(0, 8)}@federated-memory.local`,
              name: `Migrated User ${userId.substring(0, 8)}`,
              token: userId, // Use the ID as token since these are migrated users
              isActive: true
            }
          });
          console.log(`  Created placeholder user for ${userId}`);
        } catch (error) {
          console.log(`  Failed to create user ${userId}:`, error.message);
        }
      }
    }
    
    // Now index all memories
    console.log('\nStep 3: Indexing all memories...');
    
    let totalIndexed = 0;
    let totalErrors = 0;
    
    for (const moduleId of ['technical', 'personal', 'work', 'learning', 'communication', 'creative']) {
      const module = await moduleRegistry.getModule(moduleId);
      if (!module) continue;
      
      const tableName = `${moduleId}_memories`;
      const memories = await prisma.$queryRawUnsafe<Array<{
        id: string;
        userId: string;
        content: string;
        metadata: any;
      }>>`
        SELECT id, "userId", content, metadata
        FROM "${tableName}"
        ORDER BY "createdAt" DESC
      `;
      
      console.log(`\n  Processing ${memories.length} memories from ${moduleId} module...`);
      let moduleIndexed = 0;
      
      for (const memory of memories) {
        try {
          // Check if already indexed
          const existing = await prisma.memoryIndex.findUnique({
            where: {
              moduleId_remoteMemoryId: {
                moduleId: moduleId,
                remoteMemoryId: memory.id
              }
            }
          });
          
          if (existing) {
            continue; // Skip if already indexed
          }
          
          // Extract metadata for indexing
          const title = memory.content.split('\n')[0].substring(0, 100);
          const summary = memory.content.substring(0, 200);
          const keywords = extractKeywords(memory.content);
          
          await cmiService.indexMemory(
            memory.userId,
            moduleId,
            memory.id,
            memory.content,
            {
              title,
              summary,
              keywords,
              categories: memory.metadata?.categories || [moduleId],
              importanceScore: memory.metadata?.importanceScore || 0.5,
            }
          );
          
          moduleIndexed++;
          totalIndexed++;
          
          if (moduleIndexed % 10 === 0) {
            process.stdout.write(`\r    Indexed: ${moduleIndexed}/${memories.length}`);
          }
        } catch (error) {
          totalErrors++;
          if (totalErrors <= 5) { // Only log first 5 errors
            logger.error('Failed to index memory', {
              module: moduleId,
              memoryId: memory.id,
              userId: memory.userId,
              error: error.message
            });
          }
        }
      }
      
      console.log(`\n    ✓ Indexed ${moduleIndexed} memories from ${moduleId}`);
    }
    
    // Final report
    console.log('\n' + '='.repeat(50));
    console.log('Indexing Complete!');
    console.log(`Total memories indexed: ${totalIndexed}`);
    console.log(`Total errors: ${totalErrors}`);
    
    // Verify final counts
    const indexCount = await prisma.memoryIndex.count();
    const userCount = await prisma.user.count();
    
    console.log(`\nFinal database state:`);
    console.log(`  Total CMI index entries: ${indexCount}`);
    console.log(`  Total users: ${userCount}`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('Indexing failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function extractKeywords(content: string): string[] {
  const words = content.toLowerCase().split(/\W+/);
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'is', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might'
  ]);
  
  return Array.from(new Set(words.filter(word => word.length > 3 && !stopWords.has(word)))).slice(0, 10);
}

// Run if called directly
if (require.main === module) {
  fixAndIndexMemories();
}