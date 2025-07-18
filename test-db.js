const { PrismaClient } = require('@prisma/client');

const DATABASE_URL = 'postgres://postgres:KTWIPJYJBDg5JZUn0k4DF.BDdwD_F6a0@interchange.proxy.rlwy.net:35766/railway';

async function testDatabase() {
  console.log('Testing database connectivity...');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL
      }
    }
  });

  try {
    // Test basic connection
    console.log('1. Testing basic connection...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Basic connection successful:', result);

    // Test schema
    console.log('\n2. Testing schema...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log('✅ Schema query successful. Tables found:', tables.length);
    console.log('Tables:', tables.map(t => t.table_name).join(', '));

    // Test user table specifically
    console.log('\n3. Testing user table...');
    const userCount = await prisma.user.count();
    console.log('✅ User table accessible. User count:', userCount);

    // Test a specific user query
    console.log('\n4. Testing user query...');
    const users = await prisma.user.findMany({
      take: 3,
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true
      }
    });
    console.log('✅ User query successful. Sample users:', users);

    console.log('\n🎉 All database tests passed!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase(); 