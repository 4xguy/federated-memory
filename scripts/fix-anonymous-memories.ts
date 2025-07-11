import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function fixAnonymousMemories() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== Reassigning Anonymous Memories ===\n');
    
    // Find the correct user (keithrivas@gmail.com)
    const correctUser = await prisma.user.findFirst({
      where: { email: 'keithrivas@gmail.com' }
    });
    
    if (!correctUser) {
      console.error('Could not find user with email keithrivas@gmail.com');
      return;
    }
    
    const anonymousUserId = 'anonymous';
    
    console.log(`Will reassign memories from anonymous to: ${correctUser.id} (${correctUser.email})\n`);
    
    // Update memories in each module
    const modules = ['technical', 'personal', 'work', 'learning', 'communication', 'creative'];
    let totalUpdated = 0;
    
    for (const module of modules) {
      console.log(`Updating ${module} module...`);
      
      try {
        const result = await prisma.$executeRawUnsafe(`
          UPDATE "${module}_memories"
          SET "userId" = $1
          WHERE "userId" = $2
        `, correctUser.id, anonymousUserId);
        
        console.log(`  Updated ${result} memories`);
        totalUpdated += Number(result);
      } catch (error) {
        console.log(`  Error updating module: ${error}`);
      }
    }
    
    // Update CMI index
    console.log('\nUpdating CMI index...');
    const cmiResult = await prisma.$executeRaw`
      UPDATE memory_index
      SET "userId" = ${correctUser.id}
      WHERE "userId" = ${anonymousUserId}
    `;
    console.log(`  Updated ${cmiResult} index entries`);
    
    // Update memory relationships if any
    console.log('\nUpdating memory relationships...');
    const relationResult = await prisma.$executeRaw`
      UPDATE memory_relationships
      SET "userId" = ${correctUser.id}
      WHERE "userId" = ${anonymousUserId}
    `;
    console.log(`  Updated ${relationResult} relationships`);
    
    console.log(`\n✅ Reassigned ${totalUpdated} memories from anonymous to ${correctUser.email}`);
    
    // Final verification
    console.log('\n=== Final Memory Count ===');
    
    for (const module of modules) {
      try {
        const count = await prisma.$queryRawUnsafe(`
          SELECT COUNT(*) as count
          FROM "${module}_memories"
          WHERE "userId" = $1
        `, correctUser.id);
        
        const result = count as Array<{ count: bigint }>;
        console.log(`${module}: ${result[0].count} memories`);
      } catch (error) {
        console.log(`Error checking ${module}: ${error}`);
      }
    }
    
    // Check total CMI count
    const cmiCount = await prisma.memoryIndex.count({
      where: { userId: correctUser.id }
    });
    console.log(`\nTotal CMI Index entries: ${cmiCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixAnonymousMemories().catch(console.error);