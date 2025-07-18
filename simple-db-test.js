const { Client } = require('pg');

const DATABASE_URL = 'postgres://postgres:KTWIPJYJBDg5JZUn0k4DF.BDdwD_F6a0@interchange.proxy.rlwy.net:35766/railway';

async function testDatabase() {
  console.log('🔍 Testing Production Database...');
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Test 1: Basic query
    const result = await client.query('SELECT version() as version, current_database() as db_name, current_user as user');
    console.log('✅ Basic query successful:', result.rows[0]);

    // Test 2: Check tables
    const tables = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('✅ Tables found:', tables.rows.length);
    console.log('Tables:', tables.rows.map(t => t.table_name).join(', '));

    // Test 3: Check users table
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log('✅ Users table accessible. Count:', userCount.rows[0].count);

    // Test 4: Check recent users
    const recentUsers = await client.query(`
      SELECT id, email, name, is_active, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.log('✅ Recent users query successful. Found:', recentUsers.rows.length);
    recentUsers.rows.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.email || 'No email'} (${user.name || 'No name'}) - Active: ${user.is_active}`);
    });

    // Test 5: Check vector extension
    const vectorTest = await client.query(`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `);
    console.log('✅ Vector extension:', vectorTest.rows.length > 0 ? 'Available' : 'Not found');

    console.log('\n🎉 Database tests completed successfully!');

  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Error details:', {
      code: error.code,
      hint: error.hint,
      position: error.position
    });
  } finally {
    await client.end();
  }
}

testDatabase(); 