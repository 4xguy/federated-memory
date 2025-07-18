const { PrismaClient } = require('@prisma/client');

const PRODUCTION_DATABASE_URL = 'postgres://postgres:KTWIPJYJBDg5JZUn0k4DF.BDdwD_F6a0@interchange.proxy.rlwy.net:35766/railway';

async function testProductionDatabase() {
  console.log('🔍 Testing Production Database Connectivity...');
  console.log('URL:', PRODUCTION_DATABASE_URL.replace(/:[^:@]*@/, ':***@'));
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: PRODUCTION_DATABASE_URL
      }
    },
    log: ['error', 'warn']
  });

  try {
    // Test 1: Basic connection
    console.log('\n1️⃣ Testing basic connection...');
    const result = await prisma.$queryRaw`SELECT 1 as test, current_database() as db_name, current_user as user`;
    console.log('✅ Basic connection successful:', result[0]);

    // Test 2: Check schema and tables
    console.log('\n2️⃣ Checking database schema...');
    const tables = await prisma.$queryRaw`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log('✅ Schema query successful. Tables found:', tables.length);
    console.log('Tables:', tables.map(t => `${t.table_name} (${t.table_type})`).join(', '));

    // Test 3: Check user table specifically
    console.log('\n3️⃣ Testing user table...');
    const userCount = await prisma.user.count();
    console.log('✅ User table accessible. Total users:', userCount);

    // Test 4: Check for recent users
    console.log('\n4️⃣ Checking recent users...');
    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        lastLogin: true
      }
    });
    console.log('✅ Recent users query successful. Found:', recentUsers.length);
    recentUsers.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.email || 'No email'} (${user.name || 'No name'}) - Active: ${user.isActive}`);
    });

    // Test 5: Check for any active sessions
    console.log('\n5️⃣ Checking sessions...');
    const sessionCount = await prisma.session.count();
    console.log('✅ Sessions table accessible. Total sessions:', sessionCount);

    // Test 6: Test vector extension
    console.log('\n6️⃣ Testing pgvector extension...');
    const vectorTest = await prisma.$queryRaw`SELECT version() as pg_version, pg_extension.extname as vector_extension FROM pg_extension WHERE extname = 'vector'`;
    console.log('✅ Vector extension check:', vectorTest.length > 0 ? 'Available' : 'Not found');

    console.log('\n🎉 Production database tests completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Database: ${result[0].db_name}`);
    console.log(`   - User: ${result[0].user}`);
    console.log(`   - Tables: ${tables.length}`);
    console.log(`   - Users: ${userCount}`);
    console.log(`   - Sessions: ${sessionCount}`);
    
  } catch (error) {
    console.error('❌ Production database test failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      hint: error.hint
    });
  } finally {
    await prisma.$disconnect();
  }
}

testProductionDatabase(); 