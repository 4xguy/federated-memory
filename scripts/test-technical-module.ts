import 'dotenv/config';
import { TechnicalModule } from '../src/modules/technical';
import { getCMIService } from '../src/core/cmi/index.service';
import { getEmbeddingService } from '../src/core/embeddings/generator.service';
import { prisma } from '../src/utils/database';
import { logger } from '../src/utils/logger';

async function testTechnicalModule() {
  logger.info('Starting Technical Module test...');

  try {
    // Initialize services
    const cmiService = getCMIService();
    const embeddingService = getEmbeddingService();
    
    // Create Technical Module instance
    const technicalModule = new TechnicalModule();
    await technicalModule.initialize();
    
    logger.info('Technical Module initialized successfully');

    // Test user ID
    const testUserId = 'test-user-123';

    // Test 1: Store a memory about TypeScript error
    logger.info('\n=== Test 1: Storing TypeScript error memory ===');
    const errorMemoryId = await technicalModule.store(
      testUserId,
      `TypeError: Cannot read property 'name' of undefined
      
      This error occurs when trying to access a property on an undefined object.
      
      Solution: Add optional chaining or null checks:
      \`\`\`typescript
      // Instead of
      const name = user.name;
      
      // Use
      const name = user?.name || 'default';
      \`\`\`
      
      Stack trace:
      at Object.<anonymous> (src/index.ts:42:15)
      at Module._compile (internal/modules/cjs/loader.js:1063:30)`,
      {
        tool: 'vscode',
        language: 'typescript',
        framework: 'node',
        tags: ['error-handling', 'null-safety']
      }
    );
    
    logger.info(`Stored error memory with ID: ${errorMemoryId}`);

    // Test 2: Store a code snippet memory
    logger.info('\n=== Test 2: Storing code snippet memory ===');
    const codeMemoryId = await technicalModule.store(
      testUserId,
      `React Hook for debounced search:
      
      \`\`\`javascript
      import { useState, useEffect } from 'react';
      
      function useDebounce(value, delay) {
        const [debouncedValue, setDebouncedValue] = useState(value);
        
        useEffect(() => {
          const handler = setTimeout(() => {
            setDebouncedValue(value);
          }, delay);
          
          return () => clearTimeout(handler);
        }, [value, delay]);
        
        return debouncedValue;
      }
      \`\`\`
      
      This hook delays updating the value until after the specified delay.`,
      {
        language: 'javascript',
        framework: 'react',
        tags: ['hooks', 'performance', 'search']
      }
    );
    
    logger.info(`Stored code snippet memory with ID: ${codeMemoryId}`);

    // Test 3: Search for TypeScript errors
    logger.info('\n=== Test 3: Searching for TypeScript errors ===');
    const errorSearchResults = await technicalModule.search(
      testUserId,
      'TypeError undefined property TypeScript',
      {
        limit: 5,
        filters: {
          language: 'typescript'
        }
      }
    );
    
    logger.info(`Found ${errorSearchResults.length} results for TypeScript errors`);
    errorSearchResults.forEach((result, index) => {
      logger.info(`Result ${index + 1}: ${result.content.substring(0, 100)}...`);
    });

    // Test 4: Search for React hooks
    logger.info('\n=== Test 4: Searching for React hooks ===');
    const hooksSearchResults = await technicalModule.search(
      testUserId,
      'React hooks useEffect useState',
      {
        limit: 5,
        filters: {
          framework: 'react'
        }
      }
    );
    
    logger.info(`Found ${hooksSearchResults.length} results for React hooks`);

    // Test 5: Get specific memory
    logger.info('\n=== Test 5: Getting specific memory ===');
    const specificMemory = await technicalModule.get(testUserId, errorMemoryId);
    if (specificMemory) {
      logger.info('Retrieved memory:', {
        id: specificMemory.id,
        contentLength: specificMemory.content.length,
        metadata: specificMemory.metadata
      });
    }

    // Test 6: Update memory
    logger.info('\n=== Test 6: Updating memory ===');
    const updateSuccess = await technicalModule.update(
      testUserId,
      errorMemoryId,
      {
        metadata: {
          ...specificMemory?.metadata,
          solution: 'Updated solution with better error handling',
          updatedAt: new Date().toISOString()
        }
      }
    );
    logger.info(`Update successful: ${updateSuccess}`);

    // Test 7: Get module stats
    logger.info('\n=== Test 7: Getting module statistics ===');
    const stats = await technicalModule.getStats(testUserId);
    logger.info('Module statistics:', stats);

    // Test 8: Test CMI routing
    logger.info('\n=== Test 8: Testing CMI routing ===');
    const routingResults = await cmiService.routeQuery(
      testUserId,
      'How to handle TypeScript errors with undefined properties'
    );
    logger.info('CMI routing results:', routingResults);

    // Test 9: Federated search through CMI
    logger.info('\n=== Test 9: Federated search through CMI ===');
    const federatedResults = await cmiService.searchMemories(
      testUserId,
      'React hooks performance optimization',
      ['technical'],
      5
    );
    logger.info(`Federated search found ${federatedResults.length} results`);

    // Test 10: Delete a memory
    logger.info('\n=== Test 10: Deleting memory ===');
    const deleteSuccess = await technicalModule.delete(testUserId, codeMemoryId);
    logger.info(`Delete successful: ${deleteSuccess}`);

    logger.info('\n✅ All tests completed successfully!');

  } catch (error) {
    logger.error('Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testTechnicalModule()
  .then(() => {
    logger.info('Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Test script failed:', error);
    process.exit(1);
  });