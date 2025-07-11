import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getCMIService } from '../src/core/cmi/index.service';
import { ModuleLoader } from '../src/core/modules/loader.service';

const prisma = new PrismaClient();

async function indexRemaining() {
  try {
    // Initialize modules
    const moduleLoader = ModuleLoader.getInstance();
    await moduleLoader.loadAllModules();
    const cmiService = getCMIService();
    
    // Find all unindexed memories
    const unindexed = await prisma.$queryRaw<Array<{
      module: string;
      id: string;
      userId: string;
      content: string;
      metadata: any;
    }>>`
      SELECT 'work' as module, id, "userId", content, metadata
      FROM work_memories m
      WHERE NOT EXISTS (
        SELECT 1 FROM memory_index mi
        WHERE mi."moduleId" = 'work'
        AND mi."remoteMemoryId" = m.id
      )
      LIMIT 30
    `;
    
    console.log(`Found ${unindexed.length} unindexed memories. Indexing...`);
    
    for (let i = 0; i < unindexed.length; i++) {
      const memory = unindexed[i];
      
      const title = memory.content.split('\n')[0].substring(0, 100);
      const summary = memory.content.substring(0, 200);
      
      await cmiService.indexMemory(
        memory.userId,
        memory.module,
        memory.id,
        memory.content,
        {
          title,
          summary,
          keywords: [],
          categories: [memory.module],
          importanceScore: 0.5,
        }
      );
      
      console.log(`Indexed ${i + 1}/${unindexed.length}`);
    }
    
    const finalCount = await prisma.memoryIndex.count();
    console.log(`\nTotal CMI entries: ${finalCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

indexRemaining();