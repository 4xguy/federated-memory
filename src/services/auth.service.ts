import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '@/utils/database';
import { logger } from '@/utils/logger';

export interface OAuthProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  provider: 'google' | 'github';
}

export interface ApiKeyInfo {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  createdAt: Date;
  expiresAt?: Date | null;
  lastUsed?: Date | null;
}

export class AuthService {
  private static instance: AuthService;
  private readonly jwtSecret: string;
  private readonly apiKeyPrefix = 'fm_'; // federated memory

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'development-secret-change-in-production';
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // OAuth user creation/login
  async findOrCreateOAuthUser(profile: OAuthProfile) {
    const user = await prisma.user.upsert({
      where: {
        email: profile.email,
      },
      update: {
        name: profile.name,
        avatarUrl: profile.avatar,
        lastLogin: new Date(),
      },
      create: {
        id: `${profile.provider}_${profile.id}`,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatar,
        oauthProvider: profile.provider,
        oauthId: profile.id,
        token: '', // Not used for OAuth users
        isActive: true,
        lastLogin: new Date(),
      },
    });

    return user;
  }

  // Generate JWT for web sessions
  generateJWT(userId: string): string {
    return jwt.sign({ userId, type: 'session' }, this.jwtSecret, { expiresIn: '7d' });
  }

  // Verify JWT
  verifyJWT(token: string): { userId: string } | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      return { userId: decoded.userId };
    } catch (error) {
      return null;
    }
  }

  // Generate API key for MCP
  async generateApiKey(userId: string, name: string, expiresInDays?: number): Promise<string> {
    // Generate a secure random key
    const keyBytes = randomBytes(32);
    const fullKey = `${this.apiKeyPrefix}${keyBytes.toString('base64url')}`;

    // Store only the hash
    const keyHash = createHash('sha256').update(fullKey).digest('hex');
    const keyPrefix = fullKey.substring(0, 10);

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    await prisma.apiKey.create({
      data: {
        userId,
        name,
        keyHash,
        keyPrefix,
        expiresAt,
        scopes: ['read', 'write'],
      },
    });

    // Return the full key only once
    return fullKey;
  }

  // Validate API key for MCP requests
  async validateApiKey(apiKey: string): Promise<{ userId: string } | null> {
    if (!apiKey.startsWith(this.apiKeyPrefix)) {
      return null;
    }

    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    const key = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (!key) {
      return null;
    }

    // Check expiration
    if (key.expiresAt && key.expiresAt < new Date()) {
      return null;
    }

    // Check if user is active
    if (!key.user.isActive) {
      return null;
    }

    // Update last used
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsed: new Date() },
    });

    return { userId: key.userId };
  }

  // List user's API keys (without revealing the actual keys)
  async listApiKeys(userId: string): Promise<ApiKeyInfo[]> {
    const keys = await prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map(key => ({
      id: key.id,
      userId: key.userId,
      name: key.name,
      prefix: key.keyPrefix,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      lastUsed: key.lastUsed,
    }));
  }

  // Revoke API key
  async revokeApiKey(userId: string, keyId: string): Promise<boolean> {
    const result = await prisma.apiKey.deleteMany({
      where: {
        id: keyId,
        userId, // Ensure user owns the key
      },
    });

    return result.count > 0;
  }

  // Extract user ID from various auth methods
  async extractUserId(authHeader?: string): Promise<string | null> {
    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');

    if (type === 'Bearer') {
      // Try JWT first (web sessions)
      const jwtResult = this.verifyJWT(token);
      if (jwtResult) return jwtResult.userId;

      // Try API key (MCP clients)
      const apiKeyResult = await this.validateApiKey(token);
      if (apiKeyResult) return apiKeyResult.userId;
    }

    return null;
  }
}
