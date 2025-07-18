#!/usr/bin/env node

/**
 * EMERGENCY: Direct connection reset using connection string
 * This bypasses all pooling and uses a single connection
 */

const { Client } = require('pg');

// Direct connection string - update if needed
const connectionString = process.argv[2] || 'postgres://postgres:KTWIPJYJBDg5JZUn0k4DF.BDdwD_F6a0@interchange.proxy.rlwy.net:35766/railway';

async function emergencyReset() {
  const client = new Client({
    connectionString,
    // Minimal connection settings
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('🚨 EMERGENCY CONNECTION RESET');
    console.log('Attempting to connect...');
    
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Get current state
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE pid = pg_backend_pid()) as this_connection,
        COUNT(*) FILTER (WHERE pid <> pg_backend_pid()) as other_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    
    const stats = statsResult.rows[0];
    console.log(`Current connections: ${stats.total} total`);
    console.log(`  This script: 1`);
    console.log(`  Others: ${stats.other_connections}\n`);

    if (stats.other_connections > 0) {
      console.log('Terminating ALL other connections...');
      
      // Terminate everything except our connection
      const terminateResult = await client.query(`
        SELECT pg_terminate_backend(pid) as terminated, 
               application_name,
               client_addr,
               state,
               state_change
        FROM pg_stat_activity
        WHERE pid <> pg_backend_pid()
          AND datname = current_database()
      `);
      
      console.log(`\n✅ Terminated ${terminateResult.rows.length} connections:`);
      terminateResult.rows.forEach(row => {
        console.log(`  - ${row.application_name || 'unknown'} (${row.state})`);
      });
    }

    // Verify final state
    const finalResult = await client.query(`
      SELECT COUNT(*) as total
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    
    console.log(`\n✅ Final connection count: ${finalResult.rows[0].total}`);
    console.log('Database is now accessible!');

  } catch (error) {
    console.error('\n❌ FAILED:', error.message);
    
    if (error.message.includes('too many clients')) {
      console.log('\n🔥 Database is completely saturated!');
      console.log('You MUST restart the database via Railway dashboard:');
      console.log('1. Go to Railway dashboard');
      console.log('2. Select PostgreSQL service');
      console.log('3. Click menu → Restart');
    }
  } finally {
    await client.end();
  }
}

// Run immediately
console.log('Starting emergency connection reset...\n');
emergencyReset().catch(console.error);