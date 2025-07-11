import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getCMIService } from '../src/core/cmi/index.service';
import { ModuleLoader } from '../src/core/modules/loader.service';
import { ModuleRegistry } from '../src/core/modules/registry.service';

const prisma = new PrismaClient();

const BATCH_SIZE = 50; // Process 50 memories at a time

async function indexMemoriesBatch(moduleId: string, offset: number = 0) {
  try {
    // Initialize modules if not already done
    const moduleLoader = ModuleLoader.getInstance();
    await moduleLoader.loadAllModules();
    
    const cmiService = getCMIService();
    const tableName = `${moduleId}_memories`;
    
    // Get batch of memories
    const memories = await prisma.$queryRawUnsafe<Array<{
      id: string;
      userId: string;
      content: string;
      metadata: any;
    }>>(`
      SELECT id, "userId", content, metadata
      FROM "${tableName}"
      ORDER BY "createdAt" DESC
      LIMIT ${BATCH_SIZE}
      OFFSET ${offset}
    `);
    
    if (memories.length === 0) {
      console.log(`✓ Completed indexing ${moduleId} module`);
      return 0;
    }
    
    console.log(`Processing ${memories.length} memories from ${moduleId} (offset: ${offset})...`);
    
    let indexed = 0;
    let errors = 0;
    
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
          continue;
        }
        
        // Check if user exists, create if not
        const userExists = await prisma.user.findUnique({
          where: { id: memory.userId }
        });
        
        if (!userExists) {
          console.log(`  Creating user: ${memory.userId}`);
          await prisma.user.create({
            data: {
              id: memory.userId,
              email: `user-${memory.userId.substring(0, 8)}@migrated.local`,
              name: `Migrated User`,
              token: memory.userId,
              isActive: true
            }
          });
        }
        
        // Extract metadata for indexing
        const title = memory.content.split('\n')[0].substring(0, 100);
        const summary = memory.content.substring(0, 200) + '...';
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
        
        indexed++;
      } catch (error) {
        errors++;
        if (errors <= 3) {
          console.error(`  Error indexing memory ${memory.id}:`, error.message);
        }
      }
    }
    
    console.log(`  Batch complete: indexed ${indexed}, errors ${errors}`);
    
    return memories.length;
  } catch (error) {
    console.error(`Failed to process ${moduleId} batch at offset ${offset}:`, error);
    return -1;
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

async function indexAllModules() {
  console.log('Batch indexing all memories in CMI...\n');
  
  try {
    const modules = ['technical', 'personal', 'work', 'learning', 'communication', 'creative'];
    
    for (const moduleId of modules) {
      console.log(`\nIndexing ${moduleId} module...`);
      
      let offset = 0;
      let processed = 0;
      
      while (true) {
        const count = await indexMemoriesBatch(moduleId, offset);
        
        if (count === -1) {
          // Error occurred, skip to next module
          break;
        }
        
        if (count === 0) {
          // No more memories
          break;
        }
        
        processed += count;
        offset += BATCH_SIZE;
        
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`${moduleId}: processed ${processed} total memories`);
    }
    
    // Final report
    const indexCount = await prisma.memoryIndex.count();
    console.log(`\n=== Indexing Complete ===`);
    console.log(`Total CMI entries: ${indexCount}`);
    
  } catch (error) {
    console.error('Batch indexing failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  indexAllModules();
}