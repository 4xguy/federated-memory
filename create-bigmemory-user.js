const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function createBigMemoryUser() {
  console.log('Creating BigMemory user in production...\n');
  
  const prisma = new PrismaClient({
    log: ['error'],
  });

  try {
    const email = 'keithrivas@gmail.com';
    const password = '70%qe6izpQ&e17Fg1IHQ';
    
    // Check if user already exists
    const existingUser = await prisma.$queryRaw`
      SELECT id, email FROM users WHERE email = ${email}
    `;
    
    if (existingUser.length > 0) {
      console.log('User already exists:', email);
      console.log('Updating password...');
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await prisma.$queryRaw`
        UPDATE users 
        SET "passwordHash" = ${hashedPassword},
            "updatedAt" = NOW()
        WHERE email = ${email}
      `;
      
      console.log('✅ User password updated');
    } else {
      // Create new user
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      const token = uuidv4();
      
      await prisma.$queryRaw`
        INSERT INTO users (
          id, email, token, "passwordHash", "isActive", "createdAt", "updatedAt", name
        ) VALUES (
          ${userId},
          ${email},
          ${token},
          ${hashedPassword},
          true,
          NOW(),
          NOW(),
          'Keith Rivas'
        )
      `;
      
      console.log('✅ User created successfully');
    }
    
    console.log('\n📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('✅ Active: true');
    console.log('\nYou can now log in on production!');
    
  } catch (error) {
    console.error('Error:', error.constructor.name + ':', error.message);
    if (error.code === '23505') {
      console.log('\nUser already exists. Try logging in!');
    }
  } finally {
    await prisma.$disconnect();
  }
}

createBigMemoryUser().catch(console.error);