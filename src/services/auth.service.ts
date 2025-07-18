import { randomUUID } from 'crypto';
import { prisma } from '@/utils/database';
import { logger } from '@/utils/logger';

export interface OAuthProfile {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  provider: 'google' | 'github';
}

export class AuthService {
  private static instance: AuthService;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Register a new user with UUID token
   */
  async registerUser(email?: string): Promise<{ token: string; userId: string }> {
    try {
      // Generate unique token
      const token = randomUUID();
      
      // Create user with minimal required data
      const user = await prisma.user.create({
        data: {
          token,
          email: email || undefined,
          metadata: {
            source: 'api',
            version: '1.0'
          }
        }
      });
      
      logger.info('User registered', { userId: user.id, hasEmail: !!email });
      
      return {
        token: user.token,
        userId: user.id
      };
    } catch (error: any) {
      if (error.code === 'P2002' && email) {
        throw new Error('Email already registered');
      }
      throw error;
    }
  }

  /**
   * Find or create user from OAuth provider
   */
  async findOrCreateOAuthUser(profile: OAuthProfile) {
    // First try to find by OAuth provider info
    let user = await prisma.user.findFirst({
      where: {
        oauthProvider: profile.provider,
        oauthId: profile.id
      }
    });

    if (!user && profile.email) {
      // Try to find by email
      user = await prisma.user.findUnique({
        where: { email: profile.email }
      });
      
      if (user) {
        // Update existing user with OAuth info
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            oauthProvider: profile.provider,
            oauthId: profile.id,
            name: profile.name || user.name,
            avatarUrl: profile.avatar || user.avatarUrl,
            lastLogin: new Date(),
          }
        });
      }
    }

    if (!user) {
      // Create new user
      const token = randomUUID();
      user = await prisma.user.create({
        data: {
          token,
          email: profile.email || undefined,
          emailVerified: true, // OAuth providers verify email
          name: profile.name,
          avatarUrl: profile.avatar,
          oauthProvider: profile.provider,
          oauthId: profile.id,
          isActive: true,
          lastLogin: new Date(),
          metadata: {
            source: `oauth_${profile.provider}`,
            version: '1.0'
          }
        }
      });
    } else {
      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });
    }

    return user;
  }

  /**
   * Validate UUID token
   */
  async validateToken(token: string): Promise<{ userId: string } | null> {
    if (!token) {
      return null;
    }

    // Validate token format (UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      logger.debug('Invalid token format', { token: token.substring(0, 8) + '...' });
      return null;
    }

    // Look up user by token
    const user = await prisma.user.findUnique({
      where: { token },
      select: {
        id: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return null;
    }

    // Update last login (fire and forget)
    prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    }).catch(err => logger.error('Failed to update last login', err));

    return { userId: user.id };
  }

  /**
   * Rotate user token
   */
  async rotateToken(userId: string): Promise<string> {
    const newToken = randomUUID();
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: { 
        token: newToken,
        metadata: {
          // Preserve existing metadata and add rotation info
          ...(await prisma.user.findUnique({ where: { id: userId }, select: { metadata: true } }))?.metadata as any || {},
          lastTokenRotation: new Date().toISOString()
        }
      }
    });
    
    logger.info('Token rotated', { userId });
    
    return user.token;
  }

  /**
   * Extract user ID from authorization header
   */
  async extractUserId(authHeader?: string): Promise<string | null> {
    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');

    if (type === 'Bearer' && token) {
      const result = await this.validateToken(token);
      return result?.userId || null;
    }

    return null;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        token: true, // Include token for OAuth flows
        email: true,
        name: true,
        avatarUrl: true,
        isActive: true,
        metadata: true,
        createdAt: true
      }
    });
  }

  /**
   * List all users (admin only)
   */
  async listUsers(options?: { limit?: number; offset?: number }) {
    const { limit = 50, offset = 0 } = options || {};
    
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          lastLogin: true,
          createdAt: true
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count()
    ]);

    return { users, total };
  }
}