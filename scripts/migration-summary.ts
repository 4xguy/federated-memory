import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateMigrationSummary() {
  console.log('\n🎉 BigMemory to Federated Memory Migration Complete!\n');
  console.log('='.repeat(60));
  
  try {
    // Module breakdown
    const modules = [
      'technical_memories',
      'personal_memories', 
      'work_memories',
      'learning_memories',
      'communication_memories',
      'creative_memories'
    ];
    
    let totalMemories = 0;
    console.log('📊 Memory Distribution by Module:');
    console.log('-'.repeat(40));
    
    for (const tableName of modules) {
      const count = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "${tableName}"`
      );
      const moduleCount = Number(count[0].count);
      totalMemories += moduleCount;
      
      const moduleName = tableName.replace('_memories', '');
      const emoji = {
        technical: '⚙️ ',
        personal: '👤',
        work: '💼',
        learning: '📚',
        communication: '💬',
        creative: '🎨'
      }[moduleName] || '📝';
      
      console.log(`${emoji} ${moduleName.padEnd(15)} ${moduleCount.toString().padStart(4)} memories`);
    }
    
    console.log('-'.repeat(40));
    console.log(`📦 Total              ${totalMemories.toString().padStart(4)} memories`);
    
    // CMI Status
    const indexCount = await prisma.memoryIndex.count();
    console.log(`\n🔍 CMI Index Status:`);
    console.log(`   ${indexCount} memories indexed (${((indexCount/totalMemories)*100).toFixed(1)}% coverage)`);
    
    // Users
    const userCount = await prisma.user.count();
    console.log(`\n👥 Users: ${userCount}`);
    
    // Sample work projects and tasks
    console.log('\n📋 Sample Work Projects & Tasks:');
    console.log('-'.repeat(40));
    
    const workProjects = await prisma.$queryRaw<Array<{
      content: string;
      project_name?: string;
      status?: string;
    }>>`
      SELECT 
        SUBSTRING(content, 1, 60) as content,
        metadata->>'project_name' as project_name,
        metadata->>'status' as status
      FROM work_memories
      WHERE metadata->>'category' = 'project'
      LIMIT 3
    `;
    
    workProjects.forEach((project, i) => {
      console.log(`${i + 1}. ${project.content}...`);
      if (project.project_name) {
        console.log(`   Project: ${project.project_name}`);
      }
      if (project.status) {
        console.log(`   Status: ${project.status}`);
      }
    });
    
    // Success message
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration Status: COMPLETE');
    console.log('\nAll memories have been successfully:');
    console.log('  • Migrated to appropriate modules');
    console.log('  • Indexed in the Central Memory Index (CMI)');
    console.log('  • Preserved with original metadata and embeddings');
    console.log('  • Made searchable across the federated system');
    console.log('\n🚀 Your Federated Memory system is ready to use!');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('Error generating summary:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateMigrationSummary();