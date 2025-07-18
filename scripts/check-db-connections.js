#!/usr/bin/env node

/**
 * Script to check and manage PostgreSQL connections
 * Run with: node scripts/check-db-connections.js
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
  log: ['error'],
});

async function checkConnections() {
  try {
    console.log('Checking PostgreSQL connections...\n');

    // Get current connection stats
    const connections = await prisma.$queryRaw`
      SELECT 
        pid,
        usename,
        application_name,
        client_addr,
        state,
        state_change,
        query_start,
        backend_start,
        wait_event_type,
        wait_event
      FROM pg_stat_activity
      WHERE datname = current_database()
      ORDER BY backend_start DESC
    `;

    console.log(`Total active connections: ${connections.length}\n`);

    // Group by application
    const byApp = {};
    connections.forEach(conn => {
      const app = conn.application_name || 'unknown';
      byApp[app] = (byApp[app] || 0) + 1;
    });

    console.log('Connections by application:');
    Object.entries(byApp).forEach(([app, count]) => {
      console.log(`  ${app}: ${count}`);
    });

    // Show idle connections
    const idleConnections = connections.filter(c => c.state === 'idle');
    console.log(`\nIdle connections: ${idleConnections.length}`);

    if (idleConnections.length > 0) {
      console.log('\nIdle connection details:');
      idleConnections.forEach(conn => {
        const idleTime = new Date() - new Date(conn.state_change);
        const idleMinutes = Math.floor(idleTime / 1000 / 60);
        console.log(`  PID ${conn.pid}: idle for ${idleMinutes} minutes`);
      });
    }

    // Get max connections setting
    const maxConns = await prisma.$queryRaw`
      SELECT setting FROM pg_settings WHERE name = 'max_connections'
    `;
    console.log(`\nMax connections allowed: ${maxConns[0].setting}`);

    // Get connection limits from pg_database
    const dbLimits = await prisma.$queryRaw`
      SELECT datname, datconnlimit 
      FROM pg_database 
      WHERE datname = current_database()
    `;
    const limit = dbLimits[0].datconnlimit;
    console.log(`Database connection limit: ${limit === -1 ? 'unlimited' : limit}`);

    // Calculate usage
    const usage = (connections.length / parseInt(maxConns[0].setting)) * 100;
    console.log(`\nConnection usage: ${usage.toFixed(1)}%`);

    if (usage > 80) {
      console.log('\n⚠️  WARNING: Connection usage is high!');
    }

    return { connections, idleConnections };
  } catch (error) {
    console.error('Error checking connections:', error);
    throw error;
  }
}

async function terminateIdleConnections(minutes = 30) {
  try {
    console.log(`\nTerminating connections idle for more than ${minutes} minutes...`);

    const result = await prisma.$queryRaw`
      SELECT pg_terminate_backend(pid) as terminated, pid
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND state = 'idle'
        AND state_change < NOW() - INTERVAL '${minutes} minutes'
        AND pid <> pg_backend_pid()
    `;

    console.log(`Terminated ${result.length} idle connections`);
    return result;
  } catch (error) {
    console.error('Error terminating connections:', error);
    throw error;
  }
}

async function main() {
  try {
    // Check current state
    const { idleConnections } = await checkConnections();

    // If there are many idle connections, offer to clean them
    if (idleConnections.length > 10) {
      console.log('\n⚠️  Found many idle connections.');
      console.log('To terminate idle connections older than 30 minutes, run:');
      console.log('  node scripts/check-db-connections.js --terminate\n');
    }

    // Handle --terminate flag
    if (process.argv.includes('--terminate')) {
      await terminateIdleConnections(30);
      console.log('\nRechecking connections...');
      await checkConnections();
    }

  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();