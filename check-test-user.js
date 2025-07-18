const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function checkTestUser() {
  try {
    console.log('Checking test user in database...\n');
    
    const user = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });
    
    if (!user) {
      console.log('User not found in database');
      return;
    }
    
    console.log('User found:');
    console.log('- ID:', user.id);
    console.log('- Email:', user.email);
    console.log('- Email verified:', user.emailVerified);
    console.log('- Has password hash:', !!user.passwordHash);
    console.log('- Password hash:', user.passwordHash ? user.passwordHash.substring(0, 20) + '...' : 'none');
    console.log('- Active:', user.active);
    console.log('- Created:', user.createdAt);
    
    if (user.passwordHash) {
      // Test if the password matches
      const testPassword = 'TestPassword123!';
      const matches = await bcrypt.compare(testPassword, user.passwordHash);
      console.log('\nPassword test:');
      console.log('- Testing password:', testPassword);
      console.log('- Password matches:', matches);
      
      // Check if it might be a SHA256 hash
      if (user.passwordHash.length === 64 && !user.passwordHash.startsWith('$')) {
        console.log('- Looks like SHA256 hash (needs migration)');
      }
    }
    
    // Check for auth tokens
    const tokens = await prisma.authToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    console.log('\nAuth tokens:', tokens.length);
    tokens.forEach((token, i) => {
      console.log(`Token ${i + 1}:`, {
        token: token.token.substring(0, 20) + '...',
        active: token.active,
        createdAt: token.createdAt
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTestUser();