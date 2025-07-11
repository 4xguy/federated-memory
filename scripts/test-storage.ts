import 'dotenv/config';
import { TechnicalModule } from '../src/modules/technical';
import { getEmbeddingService } from '../src/core/embeddings/generator.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const embeddingService = getEmbeddingService();

async function testStorage() {
  console.log('Testing storage functionality...\n');
  
  try {
    // Initialize module
    const techModule = new TechnicalModule();
    
    // Test data
    const userId = 'test-user-' + Date.now();
    const content = 'How to handle CORS errors in Express.js: Use the cors middleware with proper origin configuration';
    const metadata = {
      language: 'javascript',
      framework: 'express',
      tags: ['cors', 'middleware', 'security']
    };
    
    console.log('1. Testing memory storage...');
    const memoryId = await techModule.store(userId, content, metadata);
    console.log('✓ Memory stored successfully:', memoryId);
    
    console.log('\n2. Testing memory retrieval...');
    const retrievedMemory = await techModule.get(userId, memoryId);
    if (retrievedMemory) {
      console.log('✓ Memory retrieved successfully');
      console.log('  Content:', retrievedMemory.content);
      console.log('  Metadata:', retrievedMemory.metadata);
    } else {
      console.log('✗ Failed to retrieve memory');
    }
    
    console.log('\n3. Testing memory search...');
    const searchResults = await techModule.search(userId, 'CORS Express', { limit: 5 });
    console.log(`✓ Found ${searchResults.length} results`);
    searchResults.forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.content.substring(0, 50)}...`);
    });
    
    console.log('\n4. Testing module stats...');
    const stats = await techModule.getStats(userId);
    console.log('✓ Module stats:', stats);
    
    console.log('\n5. Cleaning up test data...');
    const deleted = await techModule.delete(userId, memoryId);
    if (deleted) {
      console.log('✓ Test data cleaned up successfully');
    } else {
      console.log('✗ Failed to clean up test data');
    }
    
  } catch (error) {
    console.error('Storage test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testStorage();