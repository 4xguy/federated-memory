import { prisma } from '../src/utils/database';
import { getDatabaseUrl } from '../src/utils/get-database-url';

async function verifyDatabase() {
  console.log('🔍 Verifying database setup...\n');
  
  const dbUrl = getDatabaseUrl();
  const isProduction = dbUrl.includes('railway');
  const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  
  console.log(`📊 Database Type: ${isProduction ? 'PRODUCTION (Railway)' : isLocal ? 'LOCAL' : 'REMOTE'}`);
  console.log(`🔗 Connection String: ${dbUrl.replace(/:[^:@]+@/, ':****@')}\n`);
  
  try {
    // 1. Check database connection
    await prisma.$connect();
    console.log('✓ Database connection successful');
    
    // 2. Check pgvector extension
    const extensions = await prisma.$queryRaw<{extname: string}[]>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    
    if (extensions.length > 0) {
      console.log('✓ pgvector extension installed');
    } else {
      console.log('✗ pgvector extension NOT installed');
      console.log('  Run: CREATE EXTENSION IF NOT EXISTS vector;');
    }
    
    // 3. Check tables
    const tables = await prisma.$queryRaw<{tablename: string, column_count: number}[]>`
      SELECT 
        t.tablename,
        COUNT(c.column_name) as column_count
      FROM pg_tables t
      JOIN information_schema.columns c 
        ON c.table_schema = t.schemaname 
        AND c.table_name = t.tablename
      WHERE t.schemaname = 'public' 
      AND t.tablename LIKE '%memor%'
      GROUP BY t.tablename
      ORDER BY t.tablename
    `;
    
    console.log('\nMemory tables found:');
    tables.forEach(t => {
      console.log(`  - ${t.tablename} (${t.column_count} columns)`);
    });
    
    // 4. Check for vector columns
    const vectorColumns = await prisma.$queryRaw<{table_name: string, column_name: string}[]>`
      SELECT 
        table_name,
        column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND data_type = 'USER-DEFINED'
      AND udt_name = 'vector'
    `;
    
    console.log('\nVector columns found:');
    vectorColumns.forEach(c => {
      console.log(`  - ${c.table_name}.${c.column_name}`);
    });
    
    // 5. Count records in main tables
    console.log('\nDatabase statistics:');
    
    try {
      const userCount = await prisma.user.count();
      console.log(`  - Users: ${userCount}`);
    } catch (e) {
      console.log(`  - Users: Table not found`);
    }
    
    try {
      const memoryIndexCount = await prisma.memoryIndex.count();
      console.log(`  - Memory Indices: ${memoryIndexCount}`);
    } catch (e) {
      console.log(`  - Memory Indices: Table not found`);
    }
    
    try {
      const categoryCount = await prisma.category.count();
      console.log(`  - Categories: ${categoryCount}`);
    } catch (e) {
      console.log(`  - Categories: Table not found`);
    }
    
    try {
      const projectCount = await prisma.project.count();
      console.log(`  - Projects: ${projectCount}`);
    } catch (e) {
      console.log(`  - Projects: Table not found`);
    }
    
    try {
      const taskCount = await prisma.task.count();
      console.log(`  - Tasks: ${taskCount}`);
    } catch (e) {
      console.log(`  - Tasks: Table not found`);
    }
    
    // 6. Test simple insert/select
    console.log('\nTesting database operations...');
    const testUserId = 'test-user-' + Date.now();
    const testContent = 'Test memory content';
    const testEmbedding = Array(1536).fill(0.1);
    
    try {
      // Insert test memory
      await prisma.$executeRawUnsafe(`
        INSERT INTO technical_memories (
          id, "userId", content, embedding, metadata, "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3::vector, $4::jsonb, NOW()
        )
      `, testUserId, testContent, testEmbedding, {test: true});
      
      console.log('✓ Test insert successful');
      
      // Query test memory
      const result = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count 
        FROM technical_memories 
        WHERE "userId" = $1
      `, testUserId);
      
      console.log('✓ Test query successful');
      
      // Cleanup
      await prisma.$executeRawUnsafe(`
        DELETE FROM technical_memories WHERE "userId" = $1
      `, testUserId);
      
      console.log('✓ Test cleanup successful');
      
    } catch (error) {
      console.log('✗ Database operation failed:', error);
    }
    
  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDatabase();