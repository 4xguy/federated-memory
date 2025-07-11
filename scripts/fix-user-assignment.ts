import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function fixUserAssignment() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== Fixing User Assignment for Migrated Memories ===\n');
    
    // The migrated user ID
    const migratedUserId = '55f6c889-37f5-40ae-9706-ae5c7c5d2ad3';
    
    // Find the correct user (keithrivas@gmail.com)
    const correctUser = await prisma.user.findFirst({
      where: { email: 'keithrivas@gmail.com' }
    });
    
    if (!correctUser) {
      console.error('Could not find user with email keithrivas@gmail.com');
      return;
    }
    
    console.log(`Found correct user: ${correctUser.id} (${correctUser.email})`);
    console.log(`Will reassign memories from: ${migratedUserId}\n`);
    
    // Update memories in each module
    const modules = ['technical', 'personal', 'work', 'learning', 'communication', 'creative'];
    
    for (const module of modules) {
      console.log(`\nUpdating ${module} module...`);
      
      try {
        const result = await prisma.$executeRawUnsafe(`
          UPDATE "${module}_memories"
          SET "userId" = $1
          WHERE "userId" = $2
        `, correctUser.id, migratedUserId);
        
        console.log(`  Updated ${result} memories`);
      } catch (error) {
        console.log(`  Error updating module: ${error}`);
      }
    }
    
    // Update CMI index
    console.log('\nUpdating CMI index...');
    const cmiResult = await prisma.$executeRaw`
      UPDATE memory_index
      SET "userId" = ${correctUser.id}
      WHERE "userId" = ${migratedUserId}
    `;
    console.log(`  Updated ${cmiResult} index entries`);
    
    // Update memory relationships if any
    console.log('\nUpdating memory relationships...');
    const relationResult = await prisma.$executeRaw`
      UPDATE memory_relationships
      SET "userId" = ${correctUser.id}
      WHERE "userId" = ${migratedUserId}
    `;
    console.log(`  Updated ${relationResult} relationships`);
    
    // Verify the update
    console.log('\n=== Verification ===\n');
    
    for (const module of modules) {
      try {
        const count = await prisma.$queryRawUnsafe(`
          SELECT COUNT(*) as count
          FROM "${module}_memories"
          WHERE "userId" = $1
        `, correctUser.id);
        
        const result = count as Array<{ count: bigint }>;
        console.log(`${module}: ${result[0].count} memories now assigned to ${correctUser.email}`);
      } catch (error) {
        console.log(`Error checking ${module}: ${error}`);
      }
    }
    
    // Check CMI count
    const cmiCount = await prisma.memoryIndex.count({
      where: { userId: correctUser.id }
    });
    console.log(`\nCMI Index: ${cmiCount} entries assigned to ${correctUser.email}`);
    
    console.log('\n✅ User assignment fix completed!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixUserAssignment().catch(console.error);