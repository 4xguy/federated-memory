const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function testLoginDirect() {
  console.log('Testing direct database login...\n');
  
  const prisma = new PrismaClient({
    log: ['error'],
  });

  try {
    const email = 'keithrivas@gmail.com';
    const password = '70%qe6izpQ&e17Fg1IHQ';
    
    // Query without emailVerified field
    const user = await prisma.$queryRaw`
      SELECT id, email, name, "passwordHash", token, "isActive"
      FROM users 
      WHERE email = ${email}
    `;
    
    if (!user || user.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const foundUser = user[0];
    console.log('✅ User found:', foundUser.email);
    console.log('Active:', foundUser.isActive);
    
    // Check password
    const isValid = await bcrypt.compare(password, foundUser.passwordHash);
    console.log('Password valid:', isValid);
    
    if (isValid && foundUser.isActive) {
      console.log('\n✅ Login should work!');
      console.log('Token:', foundUser.token);
    } else {
      console.log('\n❌ Login would fail');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testLoginDirect().catch(console.error);