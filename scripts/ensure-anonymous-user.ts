import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function ensureAnonymousUser() {
  try {
    // Check if anonymous user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: 'anonymous' }
    });
    
    if (existingUser) {
      console.log('Anonymous user already exists');
      return;
    }
    
    // Create anonymous user
    const hashedPassword = await hash('anonymous-password-' + Date.now(), 10);
    
    const user = await prisma.user.create({
      data: {
        id: 'anonymous',
        email: 'anonymous@federated-memory.local',
        name: 'Anonymous User',
        token: randomUUID(),
        passwordHash: hashedPassword,
        isActive: true
      }
    });
    
    console.log('Created anonymous user:', user.id);
    
  } catch (error) {
    console.error('Error ensuring anonymous user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

ensureAnonymousUser();