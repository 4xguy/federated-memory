#!/usr/bin/env node

/**
 * Emergency script to clean up production database connections
 * Use when experiencing "too many clients" errors
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

// Use a minimal connection for cleanup
const prisma = new PrismaClient({
  log: ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function emergencyCleanup() {
  console.log('🚨 Running emergency connection cleanup...\n');

  try {
    // First, show current state
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE state = 'idle') as idle,
        COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
        COUNT(*) FILTER (WHERE state = 'active') as active
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    console.log('Current connection state:');
    console.log(`  Total: ${stats[0].total}`);
    console.log(`  Active: ${stats[0].active}`);
    console.log(`  Idle: ${stats[0].idle}`);
    console.log(`  Idle in transaction: ${stats[0].idle_in_transaction}\n`);

    // Terminate old idle connections (> 5 minutes)
    console.log('Terminating connections idle > 5 minutes...');
    const terminated1 = await prisma.$queryRaw`
      SELECT pg_terminate_backend(pid), application_name, state_change
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND state = 'idle'
        AND state_change < NOW() - INTERVAL '5 minutes'
        AND pid <> pg_backend_pid()
    `;
    console.log(`  Terminated ${terminated1.length} idle connections`);

    // Terminate idle in transaction (> 2 minutes) - these are more problematic
    console.log('\nTerminating connections idle in transaction > 2 minutes...');
    const terminated2 = await prisma.$queryRaw`
      SELECT pg_terminate_backend(pid), application_name, state_change
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND state = 'idle in transaction'
        AND state_change < NOW() - INTERVAL '2 minutes'
        AND pid <> pg_backend_pid()
    `;
    console.log(`  Terminated ${terminated2.length} idle in transaction connections`);

    // For extreme cases - terminate ALL idle connections except ours
    if (process.argv.includes('--aggressive')) {
      console.log('\n🔥 AGGRESSIVE MODE: Terminating ALL idle connections...');
      const terminated3 = await prisma.$queryRaw`
        SELECT pg_terminate_backend(pid), application_name
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND state IN ('idle', 'idle in transaction')
          AND pid <> pg_backend_pid()
      `;
      console.log(`  Terminated ${terminated3.length} connections`);
    }

    // Show final state
    console.log('\nFinal connection state:');
    const finalStats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE state = 'idle') as idle,
        COUNT(*) FILTER (WHERE state = 'active') as active
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;
    console.log(`  Total: ${finalStats[0].total}`);
    console.log(`  Active: ${finalStats[0].active}`);
    console.log(`  Idle: ${finalStats[0].idle}`);

    console.log('\n✅ Cleanup complete!');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run immediately
emergencyCleanup();