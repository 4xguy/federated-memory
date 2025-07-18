import { prisma } from '@/utils/database';
import { logger } from '@/utils/logger';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { addHours } from 'date-fns';
import { emailService } from '@/services/email/email.service';

export interface CreateUserResult {
  userId: string;
  token: string;
}

export interface LoginResult {
  userId: string;
  token: string;
  user: {
    id: string;
    email: string;
    name?: string;
    emailVerified: boolean;
  };
}

class EmailAuthService {
  private readonly SALT_ROUNDS = 10;
  private readonly VERIFICATION_TOKEN_EXPIRES_HOURS = 24;

  /**
   * Create a new user with email and password
   */
  async createUserWithEmail(
    email: string,
    password: string,
    metadata?: Record<string, any>
  ): Promise<CreateUserResult> {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Generate verification token
    const emailVerificationToken = randomUUID();
    const emailVerificationExpires = addHours(new Date(), this.VERIFICATION_TOKEN_EXPIRES_HOURS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        token: randomUUID(),
        emailVerified: false,
        emailVerificationToken,
        emailVerificationExpires,
        isActive: true,
        metadata: {
          ...(metadata || {}),
          registrationMethod: 'email',
          registeredAt: new Date().toISOString(),
        },
      },
    });

    // Send verification email
    await emailService.sendVerificationEmail(user.email!, emailVerificationToken);
    
    logger.info('User created with email verification pending', {
      userId: user.id,
      email: user.email,
    });

    return {
      userId: user.id,
      token: user.token,
    };
  }

  /**
   * Create a CLI user (no email required)
   */
  async createCliUser(metadata?: Record<string, any>): Promise<CreateUserResult> {
    const user = await prisma.user.create({
      data: {
        token: randomUUID(),
        isActive: true,
        emailVerified: true, // CLI users don't need email verification
        metadata: {
          ...(metadata || {}),
          registrationMethod: 'cli',
          registeredAt: new Date().toISOString(),
          tier: 'free',
        },
      },
    });

    logger.info('CLI user created', { userId: user.id });

    return {
      userId: user.id,
      token: user.token,
    };
  }

  /**
   * Create a legacy user (deprecated)
   */
  async createUser(metadata?: Record<string, any>): Promise<CreateUserResult> {
    const user = await prisma.user.create({
      data: {
        token: randomUUID(),
        isActive: true,
        emailVerified: true,
        metadata: {
          ...(metadata || {}),
          registrationMethod: 'legacy',
          registeredAt: new Date().toISOString(),
        },
      },
    });

    logger.info('Legacy user created', { userId: user.id });

    return {
      userId: user.id,
      token: user.token,
    };
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<CreateUserResult | null> {
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return null;
    }

    // Update user as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    logger.info('Email verified', { userId: user.id, email: user.email });

    // Send welcome email with token
    await emailService.sendWelcomeEmail(user.email!, user.token);

    return {
      userId: user.id,
      token: user.token,
    };
  }

  /**
   * Login with email and password
   */
  async loginWithPassword(email: string, password: string): Promise<LoginResult | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        token: true,
        isActive: true,
        emailVerified: true,
      },
    });

    if (!user || !user.passwordHash) {
      return null;
    }

    // Check if account is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new Error('Email not verified');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return null;
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    logger.info('User logged in', { userId: user.id, email: user.email });

    return {
      userId: user.id,
      token: user.token,
      user: {
        id: user.id,
        email: user.email!,
        name: user.name || undefined,
        emailVerified: user.emailVerified,
      },
    };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.emailVerified) {
      // Don't reveal if email exists
      return;
    }

    // Generate new verification token
    const emailVerificationToken = randomUUID();
    const emailVerificationExpires = addHours(new Date(), this.VERIFICATION_TOKEN_EXPIRES_HOURS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken,
        emailVerificationExpires,
      },
    });

    // Send verification email
    await emailService.sendVerificationEmail(user.email!, emailVerificationToken);
    
    logger.info('Verification email resent', { userId: user.id, email: user.email });
  }

  /**
   * Rotate user token
   */
  async rotateToken(currentToken: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { token: currentToken },
    });

    if (!user) {
      throw new Error('Invalid token');
    }

    const newToken = randomUUID();

    await prisma.user.update({
      where: { id: user.id },
      data: { token: newToken },
    });

    logger.info('Token rotated', { userId: user.id });

    return newToken;
  }

  /**
   * Deactivate user account
   */
  async deactivateAccount(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    logger.info('Account deactivated', { userId });
  }

  /**
   * Reactivate user account
   */
  async reactivateAccount(email: string, password: string): Promise<LoginResult | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return null;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return null;
    }

    // Reactivate account
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: true },
    });

    logger.info('Account reactivated', { userId: user.id });

    return {
      userId: user.id,
      token: user.token,
      user: {
        id: user.id,
        email: user.email!,
        name: user.name || undefined,
        emailVerified: user.emailVerified,
      },
    };
  }

  /**
   * Create auth URL for magic link login
   */
  async createAuthUrl(token: string): Promise<string> {
    // TODO: Get base URL from config
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${baseUrl}/auth?token=${token}`;
  }

  /**
   * Get current user info
   */
  async getCurrentUser(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
        metadata: true,
      },
    });
  }
}

export const emailAuthService = new EmailAuthService();