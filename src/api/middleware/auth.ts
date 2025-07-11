import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/utils/database';
import { Logger } from '@/utils/logger';
import jwt from 'jsonwebtoken';

const logger = Logger.getInstance();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Check for Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }

    // Extract token
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

    if (!token) {
      res.status(401).json({ error: 'Token required' });
      return;
    }

    // Verify JWT token if JWT_SECRET is set
    if (process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

        // Find user by decoded info
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
        });

        if (!user) {
          res.status(401).json({ error: 'Invalid token - user not found' });
          return;
        }

        req.user = {
          id: user.id,
          email: user.email,
        };
        next();
        return;
      } catch (jwtError) {
        // If JWT verification fails, fall back to token lookup
        logger.debug('JWT verification failed, trying token lookup', { jwtError });
      }
    }

    // Fall back to simple token lookup
    const user = await prisma.user.findFirst({
      where: { token },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error', { error });
    res.status(500).json({ error: 'Authentication failed' });
  }
}
