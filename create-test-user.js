const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    console.log('Creating test user...\n');
    
    const email = 'test@example.com';
    const password = 'TestPassword123!';
    
    // Delete existing user if any
    await prisma.user.deleteMany({
      where: { email }
    });
    console.log('Cleaned up existing test user');
    
    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create the user
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        token: crypto.randomUUID(), // Required UUID token
        email,
        passwordHash,
        emailVerified: true, // Set to true for testing
        emailVerificationToken: null,
        emailVerificationExpires: null,
        isActive: true
      }
    });
    
    console.log('User created successfully:');
    console.log('- ID:', user.id);
    console.log('- Email:', user.email);
    console.log('- Email verified:', user.emailVerified);
    console.log('- Password hash:', user.passwordHash.substring(0, 20) + '...');
    console.log('- Active:', user.isActive);
    
    // Test the password
    const matches = await bcrypt.compare(password, user.passwordHash);
    console.log('\nPassword verification:', matches ? 'SUCCESS' : 'FAILED');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();