import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function checkUserMapping() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== Checking User Mapping in Federated Memory ===\n');
    
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        token: true,
        createdAt: true
      }
    });
    
    console.log(`Found ${users.length} users in the system:`);
    users.forEach(user => {
      console.log(`- ${user.id}: ${user.email || user.name || 'Anonymous'} (created: ${user.createdAt.toISOString()})`);
    });
    
    console.log('\n=== Memory Distribution by User ===\n');
    
    // Check each module for memory counts by user
    const modules = ['technical', 'personal', 'work', 'learning', 'communication', 'creative'];
    
    for (const module of modules) {
      console.log(`\n${module.toUpperCase()} Module:`);
      
      try {
        // Get unique user IDs and counts from this module
        const result = await prisma.$queryRawUnsafe(`
          SELECT "userId", COUNT(*) as count
          FROM "${module}_memories"
          GROUP BY "userId"
          ORDER BY count DESC
        `);
        
        const userCounts = result as Array<{ userId: string; count: bigint }>;
        
        if (userCounts.length === 0) {
          console.log('  No memories found');
        } else {
          userCounts.forEach(({ userId, count }) => {
            const user = users.find(u => u.id === userId);
            const userInfo = user ? (user.email || user.name || 'Anonymous') : 'UNKNOWN USER';
            console.log(`  User ${userId} (${userInfo}): ${count} memories`);
          });
        }
      } catch (error) {
        console.log(`  Error querying module: ${error}`);
      }
    }
    
    console.log('\n=== CMI Index User Distribution ===\n');
    
    // Check CMI index
    const cmiResult = await prisma.$queryRaw`
      SELECT "userId", COUNT(*) as count
      FROM memory_index
      GROUP BY "userId"
      ORDER BY count DESC
    `;
    
    const cmiCounts = cmiResult as Array<{ userId: string; count: bigint }>;
    
    if (cmiCounts.length === 0) {
      console.log('No entries in CMI index');
    } else {
      cmiCounts.forEach(({ userId, count }) => {
        const user = users.find(u => u.id === userId);
        const userInfo = user ? (user.email || user.name || 'Anonymous') : 'UNKNOWN USER';
        console.log(`User ${userId} (${userInfo}): ${count} index entries`);
      });
    }
    
    console.log('\n=== Checking for Orphaned Memories ===\n');
    
    // Check for memories with user IDs that don't exist in users table
    let orphanedCount = 0;
    
    for (const module of modules) {
      try {
        const orphaned = await prisma.$queryRawUnsafe(`
          SELECT COUNT(*) as count
          FROM "${module}_memories" m
          LEFT JOIN users u ON m."userId" = u.id
          WHERE u.id IS NULL
        `);
        
        const result = orphaned as Array<{ count: bigint }>;
        const count = Number(result[0].count);
        
        if (count > 0) {
          console.log(`${module}: ${count} orphaned memories`);
          orphanedCount += count;
        }
      } catch (error) {
        console.log(`Error checking ${module}: ${error}`);
      }
    }
    
    if (orphanedCount === 0) {
      console.log('No orphaned memories found');
    } else {
      console.log(`\nTotal orphaned memories: ${orphanedCount}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkUserMapping().catch(console.error);