import session from 'express-session';
import { RequestHandler } from 'express';
import { Redis } from '@/utils/redis';
import { logger } from '@/utils/logger';

// Import connect-redis properly for v9
let RedisStore: any;
try {
  RedisStore = require('connect-redis').default;
  logger.info('RedisStore module loaded successfully');
} catch (error) {
  logger.error('Failed to load connect-redis module', error);
}

let sessionMiddleware: RequestHandler | null = null;

export function createRedisSessionMiddleware(): RequestHandler {
  // Return cached middleware if already created
  if (sessionMiddleware) {
    return sessionMiddleware;
  }

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

  // Try to use Redis for session storage
  const redis = Redis.getInstance();
  let redisAvailable = false;
  
  if (redis && RedisStore) {
    try {
      const client = redis.getClient();
      if (client && redis.isReady()) {
        logger.info('Redis client is ready, creating RedisStore...');
        
        // Create RedisStore with the client
        const store = new RedisStore({
          client: client,
          prefix: 'sess:',
          ttl: 7 * 24 * 60 * 60, // 7 days in seconds
        });
        
        sessionConfig.store = store;
        redisAvailable = true;
        logger.info('Successfully configured Redis for session storage');
      } else {
        logger.warn('Redis client not ready yet', {
          hasClient: !!client,
          isReady: redis.isReady()
        });
      }
    } catch (error) {
      logger.error('Failed to configure RedisStore', error);
    }
  } else {
    logger.warn('Redis or RedisStore not available', {
      hasRedis: !!redis,
      hasRedisStore: !!RedisStore
    });
  }
  
  if (!redisAvailable) {
    logger.warn('Redis not available for sessions, using memory store (sessions will be lost on restart)');
  }
  
  // In production with no HTTPS, warn about security
  if (process.env.NODE_ENV === 'production' && process.env.DISABLE_SECURE_COOKIES === 'true') {
    logger.warn('Secure cookies disabled in production - only use this for debugging!');
  }

  // Create and cache the middleware
  sessionMiddleware = session(sessionConfig);
  return sessionMiddleware;
}

// Function to recreate session middleware with Redis after Redis connects
export async function upgradeToRedisSession(): Promise<boolean> {
  const redis = Redis.getInstance();
  
  if (!redis || !redis.isReady()) {
    return false;
  }
  
  try {
    const client = redis.getClient();
    if (!client) {
      return false;
    }
    
    // Clear the cached middleware to force recreation
    sessionMiddleware = null;
    
    // This will create a new middleware with Redis support
    createRedisSessionMiddleware();
    
    logger.info('Session middleware upgraded to use Redis');
    return true;
  } catch (error) {
    logger.error('Failed to upgrade to Redis sessions', error);
    return false;
  }
}