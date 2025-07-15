import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

export class Redis {
  private static instance: Redis | null = null;
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  private constructor() {}

  static getInstance(): Redis | null {
    if (!process.env.REDIS_URL) {
      return null;
    }

    if (!Redis.instance) {
      Redis.instance = new Redis();
    }
    return Redis.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('Redis already connected');
      return;
    }
    
    if (!process.env.REDIS_URL) {
      logger.warn('REDIS_URL not set, Redis will not be available');
      return;
    }

    logger.info('Attempting to connect to Redis...', {
      url: process.env.REDIS_URL.replace(/:[^:@]+@/, ':****@') // Hide password in logs
    });

    try {
      this.client = createClient({
        url: process.env.REDIS_URL,
        socket: {
          connectTimeout: 10000, // 10 second timeout
          reconnectStrategy: (retries) => {
            if (retries > 3) {
              logger.error('Redis connection failed after 3 retries');
              return false; // Stop retrying
            }
            return Math.min(retries * 100, 3000); // Exponential backoff
          }
        }
      });

      this.client.on('error', (err: Error) => {
        logger.error('Redis Client Error', err);
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
      });

      await this.client.connect();
      this.isConnected = true;
      logger.info('Redis connected successfully');
      
      // Test the connection
      await this.client.ping();
      logger.info('Redis ping successful');
    } catch (error) {
      logger.error('Failed to connect to Redis, continuing without cache', error);
      // Don't throw - allow server to run without Redis
      this.client = null;
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }
    await this.client.del(keys);
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client || !this.isConnected) {
      return [];
    }
    return this.client.keys(pattern);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }
    const result = await this.client.exists(key);
    return result === 1;
  }

  async incr(key: string): Promise<number> {
    if (!this.client || !this.isConnected) {
      return 0;
    }
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }
    await this.client.expire(key, seconds);
  }

  async flush(): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }
    await this.client.flushAll();
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  getClient(): RedisClientType | null {
    return this.client;
  }
}

export default Redis;
