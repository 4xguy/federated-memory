import { Router } from 'express';
import { AuthService } from '@/services/auth.service';
import { prisma } from '@/utils/database';
import { z } from 'zod';
import { AuthRequest } from '@/api/middleware/auth';
import jwt from 'jsonwebtoken';

const router = Router();
const authService = AuthService.getInstance();

// Schema for session creation
const createSessionSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  provider: z.string().optional(),
});

// Create a session token for a NextAuth user
router.post('/session', async (req, res) => {
  try {
    const validation = createSessionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const { userId, email, name, provider } = validation.data;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      // Create user with the OAuth ID as the user ID
      user = await prisma.user.create({
        data: {
          id: userId,
          email,
          name: name || email.split('@')[0],
          token: `usr_${userId}_${Date.now()}`,
          oauthProvider: provider,
          oauthId: userId,
        }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    res.json({ 
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get current session
router.get('/session', async (req: AuthRequest, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : authHeader;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;