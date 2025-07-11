import { getCMIService } from '../src/core/cmi/index.service';
import { ModuleLoader } from '../src/core/modules/loader.service';
import { prisma } from '../src/utils/database';

async function testDirectStore() {
  console.log('Testing direct store operation...\n');

  try {
    // Load modules first
    const moduleLoader = ModuleLoader.getInstance();
    await moduleLoader.loadAllModules();
    console.log('✓ Modules loaded successfully\n');

    // Get CMI service
    const cmiService = getCMIService();

    // Test store operation
    console.log('Storing test memory...');
    const testContent = 'Direct test: PostgreSQL uses MVCC for transaction isolation';
    const testMetadata = { 
      category: 'database', 
      importance: 'high',
      timestamp: new Date().toISOString()
    };

    try {
      const memoryId = await cmiService.store(
        'test-user',
        testContent,
        testMetadata,
        'technical'
      );
      console.log(`✓ Memory stored successfully with ID: ${memoryId}\n`);

      // Search for it
      console.log('Searching for the stored memory...');
      const searchResults = await cmiService.search(
        'test-user',
        'PostgreSQL MVCC',
        { limit: 5 }
      );
      
      console.log(`✓ Found ${searchResults.length} results`);
      if (searchResults.length > 0) {
        console.log('First result:', {
          id: searchResults[0].id,
          content: searchResults[0].content.substring(0, 100) + '...',
          moduleId: searchResults[0].moduleId,
          similarity: searchResults[0].similarity
        });
      }

    } catch (error) {
      console.error('Store operation error:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }

    // Check database directly
    console.log('\nChecking database directly...');
    const recentMemories = await prisma.$queryRaw`
      SELECT id, content, "userId", "createdAt" 
      FROM technical_memories 
      WHERE "userId" = 'test-user'
      ORDER BY "createdAt" DESC 
      LIMIT 5
    `;
    console.log('Recent memories in technical_memories table:', recentMemories);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

testDirectStore();