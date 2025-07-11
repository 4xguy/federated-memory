import { prisma } from '../src/utils/database';

async function createUsers() {
  try {
    // Create anonymous user
    await prisma.user.upsert({
      where: { id: 'anonymous' },
      update: {},
      create: {
        id: 'anonymous',
        email: 'anonymous@system.local',
        token: 'system-anonymous-user'
      }
    });
    console.log('✓ Created anonymous user');

    // Create test user
    try {
      await prisma.user.upsert({
        where: { id: 'test-user' },
        update: {},
        create: {
          id: 'test-user',
          email: 'test@example.com',
          token: 'test-token'
        }
      });
      console.log('✓ Created test user');
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log('⚠️  Test user already exists (email conflict)');
      } else {
        throw error;
      }
    }

    // List all users
    const users = await prisma.user.findMany();
    console.log('\nAll users in database:');
    users.forEach(user => {
      console.log(`- ${user.id}: ${user.email}`);
    });

  } catch (error) {
    console.error('Error creating users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createUsers();