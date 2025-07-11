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
    if (this.isConnected || !process.env.REDIS_URL) {
      return;
    }

    try {
      this.client = createClient({
        url: process.env.REDIS_URL,
      });

      this.client.on('error', (err: Error) => {
        logger.error('Redis Client Error', err);
      });

      await this.client.connect();
      this.isConnected = true;
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis', error);
      throw error;
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
}

export default Redis;
