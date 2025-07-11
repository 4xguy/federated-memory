import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function checkMigrationResults() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking migration results...\n');
    
    // Check each module table
    const modules = [
      'technical_memories',
      'personal_memories', 
      'work_memories',
      'learning_memories',
      'communication_memories',
      'creative_memories'
    ];
    
    let totalMemories = 0;
    
    for (const tableName of modules) {
      const count = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "${tableName}"`
      );
      const moduleCount = Number(count[0].count);
      totalMemories += moduleCount;
      console.log(`${tableName}: ${moduleCount} memories`);
    }
    
    console.log(`\nTotal memories: ${totalMemories}`);
    
    // Check users
    const userCount = await prisma.user.count();
    console.log(`\nTotal users: ${userCount}`);
    
    // Check CMI index
    const indexCount = await prisma.memoryIndex.count();
    console.log(`CMI index entries: ${indexCount}`);
    
    // Check relationships
    const relationCount = await prisma.memoryRelationship.count();
    console.log(`Memory relationships: ${relationCount}`);
    
    // Sample some work memories (projects/tasks)
    console.log('\nSample work memories:');
    const workSamples = await prisma.$queryRaw<Array<{
      id: string;
      content: string;
      metadata: any;
    }>>`
      SELECT id, SUBSTRING(content, 1, 100) as content, metadata
      FROM work_memories
      WHERE metadata->>'category' IN ('project', 'task')
      LIMIT 5
    `;
    
    workSamples.forEach((memory, index) => {
      console.log(`\n${index + 1}. ${memory.content}...`);
      if (memory.metadata.category) {
        console.log(`   Category: ${memory.metadata.category}`);
      }
      if (memory.metadata.project_name) {
        console.log(`   Project: ${memory.metadata.project_name}`);
      }
      if (memory.metadata.status) {
        console.log(`   Status: ${memory.metadata.status}`);
      }
    });
    
  } catch (error) {
    console.error('Error checking migration results:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigrationResults();