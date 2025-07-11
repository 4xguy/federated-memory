import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function checkBigMemoryDatabase() {
  const databaseUrl = process.env.SOURCE_DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ SOURCE_DATABASE_URL environment variable not set');
    console.error('Please set it to your BigMemory PostgreSQL URL');
    process.exit(1);
  }

  console.log('🔍 Checking BigMemory database connection...\n');
  
  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl }
    }
  });

  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Connected to BigMemory database\n');

    // Get database stats
    const stats = await prisma.$queryRaw<[{
      table_name: string;
      row_count: bigint;
    }]>`
      SELECT 
        'users' as table_name,
        COUNT(*) as row_count
      FROM users
      UNION ALL
      SELECT 
        'memories' as table_name,
        COUNT(*) as row_count
      FROM memories
      WHERE is_deleted = false
      UNION ALL
      SELECT 
        'memory_relations' as table_name,
        COUNT(*) as row_count
      FROM memory_relations
      UNION ALL
      SELECT 
        'memory_categories' as table_name,
        COUNT(*) as row_count
      FROM memory_categories
      WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_categories')
    `;

    console.log('📊 Database Statistics:');
    console.log('====================');
    for (const stat of stats) {
      console.log(`${stat.table_name}: ${stat.row_count} records`);
    }

    // Sample some memories to check structure
    const sampleMemories = await prisma.$queryRaw<Array<{
      id: string;
      title: string | null;
      content: string;
      tags: string[];
      source_metadata: any;
      created_at: Date;
    }>>`
      SELECT 
        id,
        title,
        SUBSTRING(content, 1, 100) as content,
        tags,
        source_metadata,
        created_at
      FROM memories
      WHERE is_deleted = false
      ORDER BY created_at DESC
      LIMIT 5
    `;

    console.log('\n📝 Recent Memories (last 5):');
    console.log('===========================');
    sampleMemories.forEach((memory, index) => {
      console.log(`\n${index + 1}. ${memory.title || 'Untitled'}`);
      console.log(`   Content: ${memory.content}${memory.content.length >= 100 ? '...' : ''}`);
      console.log(`   Tags: ${memory.tags.join(', ') || 'none'}`);
      console.log(`   Created: ${memory.created_at.toLocaleDateString()}`);
      if (memory.source_metadata && Object.keys(memory.source_metadata).length > 0) {
        console.log(`   Metadata: ${JSON.stringify(memory.source_metadata).substring(0, 100)}...`);
      }
    });

    // Check for project/task memories
    const projectTaskCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM memories
      WHERE is_deleted = false
      AND (
        source_metadata->>'type' IN ('project', 'task')
        OR tags && ARRAY['project', 'task', 'meeting']::text[]
      )
    `;

    console.log(`\n📋 Project/Task Memories: ${projectTaskCount[0].count}`);

    // Check embedding dimensions
    const embeddingCheck = await prisma.$queryRaw<[{ has_embeddings: boolean; dimensions: number | null }]>`
      SELECT 
        EXISTS(SELECT 1 FROM memories WHERE embedding IS NOT NULL) as has_embeddings,
        (SELECT array_length(embedding::real[], 1) FROM memories WHERE embedding IS NOT NULL LIMIT 1) as dimensions
    `;

    if (embeddingCheck[0].has_embeddings) {
      console.log(`\n🧮 Embeddings: Present (${embeddingCheck[0].dimensions} dimensions)`);
    } else {
      console.log('\n🧮 Embeddings: Not found');
    }

    console.log('\n✅ BigMemory database is ready for migration!');

  } catch (error) {
    console.error('❌ Failed to connect to BigMemory database:', error);
    console.error('\nPlease check:');
    console.error('1. SOURCE_DATABASE_URL is correctly set');
    console.error('2. Database is accessible');
    console.error('3. User has proper permissions');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkBigMemoryDatabase().catch(console.error);