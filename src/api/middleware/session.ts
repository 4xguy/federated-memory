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
    try {
      const redisClient = redis.getClient();
      if (redisClient) {
        sessionConfig.store = new RedisStore({
          client: redisClient as any,
          prefix: 'sess:',
        });
        logger.info('Using Redis for session storage');
      } else {
        logger.warn('Redis client not available, using memory store for sessions');
      }
    } catch (error) {
      logger.error('Failed to configure RedisStore, using memory store', error);
    }
  } else {
    logger.warn('Redis not ready, using memory store for sessions');
  }
  
  // In production, disable secure cookies if not using HTTPS
  if (process.env.NODE_ENV === 'production' && process.env.DISABLE_SECURE_COOKIES === 'true') {
    sessionConfig.cookie!.secure = false;
    logger.warn('Secure cookies disabled in production - only for debugging!');
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