import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function initDatabase() {
  console.log('Initializing database...');
  
  try {
    // Create pgvector extension
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
    console.log('✓ pgvector extension created');
    
    // Check if tables exist
    const tables = await prisma.$queryRaw<{tablename: string}[]>`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN (
        'memory_index', 
        'memory_relationships',
        'technical_memories',
        'personal_memories',
        'work_memories',
        'learning_memories',
        'communication_memories',
        'creative_memories'
      )
    `;
    
    console.log(`✓ Found ${tables.length} memory tables`);
    
    if (tables.length === 0) {
      console.log('⚠️  No memory tables found. Please run: npm run db:migrate');
    } else {
      console.log('Tables found:', tables.map(t => t.tablename).join(', '));
    }
    
    // Test vector operations
    const testVector = Array(512).fill(0.1);
    const result = await prisma.$queryRawUnsafe(`
      SELECT $1::vector as test_vector
    `, testVector);
    
    console.log('✓ Vector operations working');
    
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

initDatabase();