import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getCMIService } from '../src/core/cmi/index.service';
import { ModuleLoader } from '../src/core/modules/loader.service';
import { ModuleRegistry } from '../src/core/modules/registry.service';

const prisma = new PrismaClient();

async function indexAllMemories() {
  console.log('Indexing all memories in CMI...\n');
  
  try {
    // Initialize modules
    const moduleLoader = ModuleLoader.getInstance();
    await moduleLoader.loadAllModules();
    
    const cmiService = getCMIService();
    
    // Get current index count
    const beforeCount = await prisma.memoryIndex.count();
    console.log(`Current CMI index entries: ${beforeCount}\n`);
    
    // Process each module
    const modules = [
      { id: 'technical', table: 'technical_memories' },
      { id: 'personal', table: 'personal_memories' },
      { id: 'work', table: 'work_memories' },
      { id: 'learning', table: 'learning_memories' },
      { id: 'communication', table: 'communication_memories' },
      { id: 'creative', table: 'creative_memories' }
    ];
    
    let totalIndexed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    for (const module of modules) {
      console.log(`Processing ${module.id} module...`);
      
      // Get all memories from this module
      const memories = await prisma.$queryRawUnsafe<Array<{
        id: string;
        userId: string;
        content: string;
        metadata: any;
        createdAt: Date;
      }>>(
        `SELECT id, "userId", content, metadata, "createdAt" FROM "${module.table}" ORDER BY "createdAt" DESC`
      );
      
      console.log(`  Found ${memories.length} memories`);
      
      let moduleIndexed = 0;
      let moduleSkipped = 0;
      let moduleErrors = 0;
      
      for (const memory of memories) {
        try {
          // Check if already indexed
          const existing = await prisma.memoryIndex.findUnique({
            where: {
              moduleId_remoteMemoryId: {
                moduleId: module.id,
                remoteMemoryId: memory.id
              }
            }
          });
          
          if (existing) {
            moduleSkipped++;
            continue;
          }
          
          // Check if user exists
          const userExists = await prisma.user.findUnique({
            where: { id: memory.userId }
          });
          
          if (!userExists) {
            console.log(`  Creating missing user: ${memory.userId}`);
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
          
          // Index the memory
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
          
          moduleIndexed++;
          
          // Show progress
          if ((moduleIndexed + moduleSkipped) % 20 === 0) {
            process.stdout.write(`\r  Progress: ${moduleIndexed + moduleSkipped}/${memories.length}`);
          }
        } catch (error) {
          moduleErrors++;
          if (moduleErrors <= 3) {
            console.error(`\n  Error indexing memory ${memory.id}:`, error.message);
          }
        }
      }
      
      console.log(`\n  ✓ Indexed: ${moduleIndexed}, Skipped: ${moduleSkipped}, Errors: ${moduleErrors}\n`);
      
      totalIndexed += moduleIndexed;
      totalSkipped += moduleSkipped;
      totalErrors += moduleErrors;
    }
    
    // Final report
    const afterCount = await prisma.memoryIndex.count();
    
    console.log('='.repeat(50));
    console.log('Indexing Complete!');
    console.log(`Memories indexed: ${totalIndexed}`);
    console.log(`Already indexed: ${totalSkipped}`);
    console.log(`Errors: ${totalErrors}`);
    console.log(`Total CMI entries: ${afterCount} (added ${afterCount - beforeCount})`);
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
  indexAllMemories();
}