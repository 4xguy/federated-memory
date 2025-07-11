import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getCMIService } from '../src/core/cmi/index.service';
import { ModuleLoader } from '../src/core/modules/loader.service';

const prisma = new PrismaClient();

async function finishIndexing() {
  console.log('Finishing CMI indexing for remaining memories...\n');
  
  try {
    // Initialize modules
    const moduleLoader = ModuleLoader.getInstance();
    await moduleLoader.loadAllModules();
    const cmiService = getCMIService();
    
    // Get current status
    const beforeCount = await prisma.memoryIndex.count();
    console.log(`Current CMI index entries: ${beforeCount}\n`);
    
    // Process remaining memories
    const modules = [
      { id: 'work', remaining: 45 },
      { id: 'learning', remaining: 4 },
      { id: 'communication', remaining: 9 },
      { id: 'creative', remaining: 1 }
    ];
    
    let totalIndexed = 0;
    
    for (const module of modules) {
      if (module.remaining === 0) continue;
      
      console.log(`Processing ${module.remaining} remaining ${module.id} memories...`);
      
      const tableName = `${module.id}_memories`;
      const unindexedMemories = await prisma.$queryRawUnsafe<Array<{
        id: string;
        userId: string;
        content: string;
        metadata: any;
      }>>(`
        SELECT m.id, m."userId", m.content, m.metadata
        FROM "${tableName}" m
        WHERE NOT EXISTS (
          SELECT 1 FROM memory_index mi
          WHERE mi."moduleId" = '${module.id}'
          AND mi."remoteMemoryId" = m.id
        )
        LIMIT 20
      `);
      
      for (const memory of unindexedMemories) {
        try {
          // Extract metadata
          const title = memory.content.split('\n')[0].substring(0, 100);
          const summary = memory.content.substring(0, 200) + '...';
          const keywords = extractKeywords(memory.content);
          
          await cmiService.indexMemory(
            memory.userId,
            module.id,
            memory.id,
            memory.content,
            {
              title,
              summary,
              keywords,
              categories: memory.metadata?.categories || [module.id],
              importanceScore: memory.metadata?.importanceScore || 0.5,
            }
          );
          
          totalIndexed++;
          process.stdout.write(`\r  Indexed: ${totalIndexed}/${module.remaining}`);
        } catch (error) {
          console.error(`\n  Failed to index ${memory.id}:`, error.message);
        }
      }
      
      console.log(); // New line after progress
    }
    
    // Final report
    const afterCount = await prisma.memoryIndex.count();
    console.log(`\n=== Indexing Complete ===`);
    console.log(`Indexed ${totalIndexed} new memories`);
    console.log(`Total CMI entries: ${afterCount}`);
    
    // Verify all memories are indexed
    let totalUnindexed = 0;
    for (const moduleId of ['technical', 'personal', 'work', 'learning', 'communication', 'creative']) {
      const [{ count }] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(*) as count
        FROM "${moduleId}_memories" m
        WHERE NOT EXISTS (
          SELECT 1 FROM memory_index mi
          WHERE mi."moduleId" = '${moduleId}'
          AND mi."remoteMemoryId" = m.id
        )
      `);
      
      const unindexed = Number(count);
      if (unindexed > 0) {
        console.log(`${moduleId}: ${unindexed} memories still unindexed`);
        totalUnindexed += unindexed;
      }
    }
    
    if (totalUnindexed === 0) {
      console.log('\n✓ All memories are now indexed!');
    } else {
      console.log(`\n⚠ ${totalUnindexed} memories still need indexing`);
    }
    
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

// Run
finishIndexing();