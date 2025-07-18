const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function createTestUser() {
  console.log('Creating test user in production...');
  
  // Railway provides the DATABASE_URL automatically
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  try {
    const email = 'keithrivas@gmail.com';
    const password = '70%qe6izpQ&e17Fg1IHQ';
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      console.log('User already exists:', email);
      console.log('Updating password...');
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await prisma.user.update({
        where: { email },
        data: {
          password: hashedPassword,
          isEmailVerified: true
        }
      });
      
      console.log('✅ User password updated and verified');
    } else {
      // Create new user
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          isEmailVerified: true,
          name: 'Keith Rivas',
        }
      });
      
      console.log('✅ User created successfully:', user.email);
    }
    
    console.log('\n📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('✅ Email verified: true');
    console.log('\nYou can now log in on production!');
    
  } catch (error) {
    console.error('Error:', error.constructor.name + ':', error.message);
    if (error.code === 'P2002') {
      console.log('\nUser might already exist. Try logging in!');
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser().catch(console.error);