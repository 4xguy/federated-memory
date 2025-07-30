import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function getUserToken(email: string, useProduction: boolean = false) {
  // Use production database URL if specified
  const databaseUrl = useProduction 
    ? process.env.PRODUCTION_DATABASE_URL 
    : process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('No database URL provided');
    process.exit(1);
  }

  // Create Prisma client
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });

  try {
    console.log(`Searching for user: ${email}`);
    console.log(`Database: ${useProduction ? 'Production' : 'Local'}\n`);
    
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        token: true,
        name: true,
        createdAt: true,
      }
    });

    if (!user) {
      console.error(`User not found: ${email}`);
      return;
    }

    console.log('User Details:');
    console.log('=============');
    console.log(`Email: ${user.email}`);
    console.log(`Name: ${user.name || 'Not set'}`);
    console.log(`User ID: ${user.id}`);
    console.log(`Token (UUID): ${user.token}`);
    console.log(`Created: ${user.createdAt.toISOString()}`);
    console.log('\nMCP Server URL:');
    console.log(`https://federated-memory-production.up.railway.app/${user.token}`);
    console.log('\nUse this URL in Claude Desktop or any MCP-compatible client.');
    
  } catch (error) {
    console.error('Error fetching user token:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const email = process.argv[2];
const useProduction = process.argv[3] === '--prod';

if (!email) {
  console.log('Usage: npm run get-token <email> [--prod]');
  console.log('Example: npm run get-token user@example.com');
  console.log('         npm run get-token user@example.com --prod');
  process.exit(1);
}

// Run the script
getUserToken(email, useProduction);