import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function checkMCPUserIssue() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== Investigating MCP User Issue ===\n');
    
    // Check who owns the 8 memories that MCP can see
    const visibleMemoryIds = [
      '37191d14-b007-4756-9029-4db712f8c1f5',
      '6f7c0ad0-22e8-4a6d-988d-6d2b958b3d4f',
      '5a529884-8acf-4d4e-be7b-de2fd2ed19af',
      '92a3fa3f-9b18-4e58-8820-60d5c6edbf69',
      '71421fed-46c0-469c-8ef6-44e19989667a',
      '2fe97805-6255-43ce-a8d5-ebc97073c613',
      '2d63fc6e-ae31-429b-9b4f-c720276c8183',
      '02f4069f-ab63-446d-a0c6-8f0594ebdac7'
    ];
    
    console.log('Checking ownership of the 8 visible memories...\n');
    
    // Check each module for these specific memories
    const modules = ['technical', 'personal', 'work', 'learning', 'communication', 'creative'];
    const foundMemories: any[] = [];
    
    for (const module of modules) {
      try {
        // Check each memory ID individually
        for (const memoryId of visibleMemoryIds) {
          const query = `
            SELECT id, "userId", content
            FROM "${module}_memories"
            WHERE id::text = $1
          `;
          
          const result = await prisma.$queryRawUnsafe(query, memoryId);
          const memories = result as Array<{id: string, userId: string, content: string}>;
          
          for (const memory of memories) {
            foundMemories.push({
              ...memory,
              module
            });
          }
        }
      } catch (error) {
        console.log(`Error querying ${module}: ${error}`);
      }
    }
    
    // Get user details
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        token: true
      }
    });
    
    const userMap = new Map(users.map(u => [u.id, u]));
    
    console.log('Found memories and their owners:');
    foundMemories.forEach(memory => {
      const user = userMap.get(memory.userId);
      const userInfo = user ? (user.email || user.name || 'Unknown') : 'UNKNOWN USER';
      console.log(`\n- Memory: ${memory.id} (${memory.module})`);
      console.log(`  User: ${memory.userId} (${userInfo})`);
      console.log(`  Content preview: ${memory.content.substring(0, 60)}...`);
    });
    
    // Now check if there's a specific user these belong to
    const userCounts = new Map<string, number>();
    foundMemories.forEach(m => {
      userCounts.set(m.userId, (userCounts.get(m.userId) || 0) + 1);
    });
    
    console.log('\n\nUser breakdown of visible memories:');
    for (const [userId, count] of userCounts.entries()) {
      const user = userMap.get(userId);
      const userInfo = user ? (user.email || user.name || 'Unknown') : 'UNKNOWN USER';
      console.log(`${userId} (${userInfo}): ${count} memories`);
    }
    
    // Check if there's an "anonymous" user that might be the default
    const anonymousUser = users.find(u => u.email === 'anonymous@federated-memory.local' || u.id === 'anonymous');
    if (anonymousUser) {
      console.log(`\n\nFound anonymous user: ${anonymousUser.id} (${anonymousUser.email})`);
      console.log('This might be the default user for MCP connections.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMCPUserIssue().catch(console.error);