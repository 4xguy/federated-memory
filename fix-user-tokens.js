#!/usr/bin/env node

/**
 * Fix user tokens that are in the old format (usr_ID_timestamp) 
 * and convert them to proper UUIDs
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

async function fixUserTokens() {
  try {
    console.log('Checking for users with non-UUID tokens...');
    
    // Find all users with tokens that don't match UUID format
    const users = await prisma.$queryRaw`
      SELECT id, email, token 
      FROM users 
      WHERE token !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    `;
    
    console.log(`Found ${users.length} users with non-UUID tokens`);
    
    for (const user of users) {
      const newToken = randomUUID();
      console.log(`Updating user ${user.email}:`);
      console.log(`  Old token: ${user.token}`);
      console.log(`  New token: ${newToken}`);
      
      await prisma.user.update({
        where: { id: user.id },
        data: { token: newToken }
      });
    }
    
    console.log('Token update complete!');
    
    // Show the updated tokens for reference
    if (users.length > 0) {
      console.log('\nUpdated users:');
      const updatedUsers = await prisma.user.findMany({
        where: {
          id: { in: users.map(u => u.id) }
        },
        select: {
          email: true,
          token: true
        }
      });
      
      for (const user of updatedUsers) {
        console.log(`${user.email}: ${user.token}`);
      }
    }
    
  } catch (error) {
    console.error('Error fixing tokens:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  fixUserTokens().catch(console.error);
}

module.exports = { fixUserTokens };