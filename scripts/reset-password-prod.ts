import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function resetPasswordProduction(email: string, newPassword: string) {
  // Use production database URL if provided as argument or from env
  const databaseUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('No database URL provided. Set PRODUCTION_DATABASE_URL in .env');
    process.exit(1);
  }

  // Create Prisma client with production database
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });

  try {
    console.log('Connecting to production database...');
    
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.error(`User not found: ${email}`);
      return;
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        passwordHash: hashedPassword,
        updatedAt: new Date()
      }
    });

    console.log(`✅ Password successfully reset for user: ${email}`);
    console.log(`User ID: ${user.id}`);
    console.log(`New password: ${newPassword}`);
    console.log(`Database: Production`);
    
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log('Usage: npm run reset-password:prod <email> <new-password>');
  console.log('Example: npm run reset-password:prod user@example.com newpassword123');
  console.log('\nMake sure PRODUCTION_DATABASE_URL is set in your .env file');
  process.exit(1);
}

// Run the password reset
console.log(`🔐 Resetting password for ${email} on PRODUCTION database...`);
resetPasswordProduction(email, newPassword);