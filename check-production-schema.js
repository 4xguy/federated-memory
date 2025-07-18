const { Client } = require('pg');

const PRODUCTION_DATABASE_URL = 'postgres://postgres:KTWIPJYJBDg5JZUn0k4DF.BDdwD_F6a0@interchange.proxy.rlwy.net:35766/railway';

async function checkProductionSchema() {
  console.log('🔍 Checking Production Database Schema...');
  
  const client = new Client({
    connectionString: PRODUCTION_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to production database');

    // Check 1: Basic database info
    const dbInfo = await client.query('SELECT current_database() as db_name, current_user as user, version() as version');
    console.log('📊 Database Info:', dbInfo.rows[0]);

    // Check 2: Required tables
    const requiredTables = [
      'users',
      'memory_index',
      'memory_relationships',
      'memory_modules',
      'technical_memories',
      'personal_memories',
      'work_memories',
      'learning_memories',
      'communication_memories',
      'creative_memories',
      'sessions',
      'api_keys',
      'refresh_tokens'
    ];

    console.log('\n📋 Checking required tables...');
    for (const table of requiredTables) {
      try {
        const result = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          ) as exists
        `, [table]);
        
        const exists = result.rows[0].exists;
        console.log(`   ${exists ? '✅' : '❌'} ${table}`);
        
        if (exists) {
          // Check row count
          const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`      Rows: ${countResult.rows[0].count}`);
        }
      } catch (error) {
        console.log(`   ❌ ${table} - Error: ${error.message}`);
      }
    }

    // Check 3: Vector extension
    console.log('\n🔧 Checking pgvector extension...');
    const vectorResult = await client.query(`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `);
    console.log(`   Vector extension: ${vectorResult.rows.length > 0 ? '✅ Available' : '❌ Not found'}`);

    // Check 4: Sample users
    console.log('\n👥 Checking users table...');
    const users = await client.query(`
      SELECT id, email, name, is_active, created_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.log(`   Total users: ${users.rows.length}`);
    users.rows.forEach((user, i) => {
      console.log(`   ${i + 1}. ${user.email || 'No email'} (${user.name || 'No name'}) - Active: ${user.is_active}`);
    });

    // Check 5: Database size
    console.log('\n💾 Database size...');
    const sizeResult = await client.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    console.log(`   Database size: ${sizeResult.rows[0].size}`);

    console.log('\n🎉 Production database schema check completed!');

  } catch (error) {
    console.error('❌ Production database check failed:', error.message);
    console.error('Error details:', {
      code: error.code,
      hint: error.hint,
      position: error.position
    });
  } finally {
    await client.end();
  }
}

checkProductionSchema(); 