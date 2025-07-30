import { prisma } from '../src/utils/database';
import bcrypt from 'bcryptjs';
import { logger } from '../src/utils/logger';

async function resetPassword(email: string, newPassword: string) {
  try {
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

    console.log(`Password successfully reset for user: ${email}`);
    console.log(`User ID: ${user.id}`);
    console.log(`New password: ${newPassword}`);
    
  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log('Usage: npm run reset-password <email> <new-password>');
  console.log('Example: npm run reset-password user@example.com newpassword123');
  process.exit(1);
}

// Run the password reset
resetPassword(email, newPassword);