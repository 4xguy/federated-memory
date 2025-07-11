import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getCMIService } from '../src/core/cmi/index.service';
import { ModuleRegistry } from '../src/core/modules/registry.service';
import { ModuleLoader } from '../src/core/modules/loader.service';
import { Logger } from '../src/utils/logger';

const prisma = new PrismaClient();
const logger = Logger.getInstance();

async function populateCMIIndex() {
  console.log('Starting CMI index population...\n');
  
  try {
    // Initialize modules
    const moduleLoader = ModuleLoader.getInstance();
    await moduleLoader.loadAllModules();
    
    const cmiService = getCMIService();
    const moduleRegistry = ModuleRegistry.getInstance();
    const modules = await moduleRegistry.listModules();
    
    console.log(`Found ${modules.length} modules to process\n`);
    
    let totalIndexed = 0;
    let totalErrors = 0;
    
    // Process each module
    for (const moduleInfo of modules) {
      console.log(`\nProcessing module: ${moduleInfo.name} (${moduleInfo.id})`);
      
      try {
        const module = await moduleRegistry.getModule(moduleInfo.id);
        if (!module) {
          console.log(`  ⚠️  Module not found`);
          continue;
        }
        
        // Get all memories from this module's table
        const tableName = `${moduleInfo.id}_memories`;
        const memories = await prisma.$queryRawUnsafe(`
          SELECT id, "userId", content, metadata, "createdAt"
          FROM "${tableName}"
          ORDER BY "createdAt" DESC
        `);
        
        const memoryArray = memories as any[];
        console.log(`  Found ${memoryArray.length} memories`);
        
        let moduleIndexed = 0;
        let moduleErrors = 0;
        
        // Index each memory
        for (const memory of memoryArray) {
          try {
            // Extract or generate metadata for indexing
            const metadata = memory.metadata || {};
            const title = extractTitle(memory.content);
            const summary = generateSummary(memory.content);
            const keywords = extractKeywords(memory.content);
            
            await cmiService.indexMemory(
              memory.userId,
              moduleInfo.id,
              memory.id,
              memory.content,
              {
                title,
                summary,
                keywords,
                categories: metadata.categories || [],
                importanceScore: metadata.importanceScore || 0.5,
              }
            );
            
            moduleIndexed++;
            if (moduleIndexed % 10 === 0) {
              process.stdout.write(`\r  Indexed: ${moduleIndexed}/${memoryArray.length}`);
            }
          } catch (error) {
            moduleErrors++;
            logger.error('Failed to index memory', {
              module: moduleInfo.id,
              memoryId: memory.id,
              error
            });
          }
        }
        
        console.log(`\n  ✓ Indexed ${moduleIndexed} memories (${moduleErrors} errors)`);
        totalIndexed += moduleIndexed;
        totalErrors += moduleErrors;
        
      } catch (error) {
        console.log(`  ✗ Error processing module: ${error}`);
        logger.error('Module processing failed', { module: moduleInfo.id, error });
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`CMI Index Population Complete!`);
    console.log(`Total memories indexed: ${totalIndexed}`);
    console.log(`Total errors: ${totalErrors}`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('CMI index population failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper functions (same as in base.module.ts)
function extractTitle(content: string): string {
  const firstLine = content.split('\n')[0];
  return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
}

function generateSummary(content: string): string {
  return content.length > 100 ? content.substring(0, 100) + '...' : content;
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
  populateCMIIndex();
}