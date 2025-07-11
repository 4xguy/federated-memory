import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

// Use production database URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function testProductionStorage() {
  console.log('Testing production database storage...\n');
  
  try {
    // 1. Test database connection
    await prisma.$connect();
    console.log('✓ Connected to production database');
    
    // 2. Check if pgvector extension exists
    const extensions = await prisma.$queryRaw<{extname: string}[]>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    
    if (extensions.length > 0) {
      console.log('✓ pgvector extension is installed');
    } else {
      console.log('✗ pgvector extension NOT found - installing...');
      try {
        await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
        console.log('✓ pgvector extension installed');
      } catch (err) {
        console.log('✗ Failed to install pgvector:', err);
      }
    }
    
    // 3. Check tables
    const tables = await prisma.$queryRaw<{tablename: string}[]>`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename LIKE '%memor%'
      ORDER BY tablename
    `;
    
    console.log('\nMemory tables found:');
    tables.forEach(t => console.log(`  - ${t.tablename}`));
    
    if (tables.length === 0) {
      console.log('\n⚠️  No memory tables found!');
      console.log('Run on Railway: railway run npm run db:migrate:deploy');
      return;
    }
    
    // 4. Test simple insert/select
    console.log('\nTesting storage operations...');
    const testUserId = 'test-user-' + Date.now();
    const testContent = 'Test memory content for production database';
    const testEmbedding = Array(1536).fill(0.1);
    const testId = randomUUID();
    
    try {
      // Insert test memory
      const insertResult = await prisma.$queryRawUnsafe(`
        INSERT INTO "technical_memories" (
          id, "userId", content, embedding, metadata, "updatedAt"
        ) VALUES (
          $1, $2, $3, $4::vector, $5::jsonb, $6
        )
        RETURNING id, "userId", content
      `, testId, testUserId, testContent, testEmbedding, {test: true}, new Date());
      
      console.log('✓ Test insert successful:', insertResult);
      
      // Query test memory
      const queryResult = await prisma.$queryRawUnsafe(`
        SELECT id, "userId", content 
        FROM "technical_memories" 
        WHERE id = $1
      `, testId);
      
      console.log('✓ Test query successful:', queryResult);
      
      // Cleanup
      await prisma.$executeRawUnsafe(`
        DELETE FROM "technical_memories" WHERE id = $1
      `, testId);
      
      console.log('✓ Test cleanup successful');
      
      console.log('\n✅ All storage tests passed! The database is properly configured.');
      
    } catch (error) {
      console.log('\n✗ Storage operation failed:', error);
      console.log('\nThis likely means the database schema needs to be migrated.');
      console.log('Run on Railway: railway run npm run db:migrate:deploy');
    }
    
  } catch (error) {
    console.error('Production database test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testProductionStorage();