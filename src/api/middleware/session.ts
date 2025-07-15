import session from 'express-session';
import { Redis } from '@/utils/redis';
import { logger } from '@/utils/logger';
const RedisStore = require('connect-redis').default;

export function createSessionMiddleware() {
  const sessionSecret = process.env.SESSION_SECRET || 'development-secret-change-in-production';
  
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    logger.error('SESSION_SECRET environment variable is required in production - using default (INSECURE!)');
    // Don't throw - let the server start but log the security issue
  }
  
  const sessionConfig: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax', // CSRF protection
    },
  };

  // Use Redis for session storage if available
  const redis = Redis.getInstance();
  if (redis && redis.isReady()) {
    sessionConfig.store = new RedisStore({
      client: redis.getClient() as any,
      prefix: 'sess:',
    });
    logger.info('Using Redis for session storage');
  } else {
    logger.warn('Redis not available, using memory store for sessions');
  }

  return session(sessionConfig);
}

// Extend Express session type to include our OAuth request
declare module 'express-session' {
  interface SessionData {
    oauthRequest?: {
      clientId: string;
      redirectUri: string;
      scope: string;
      state?: string;
      codeChallenge?: string;
      codeChallengeMethod?: string;
    };
  }
}