import session from 'express-session';
import { logger } from '@/utils/logger';

export function createSafeSessionMiddleware() {
  const sessionSecret = process.env.SESSION_SECRET || 'development-secret-change-in-production';
  
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    logger.error('SESSION_SECRET environment variable is required in production - using default (INSECURE!)');
  }
  
  const sessionConfig: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production' && process.env.DISABLE_SECURE_COOKIES !== 'true',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax',
    },
  };

  // For now, always use memory store to avoid Redis issues
  logger.info('Using memory store for sessions (Redis disabled for stability)');
  
  return session(sessionConfig);
}