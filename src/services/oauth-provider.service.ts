import { randomBytes, createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '@/utils/database';
import { logger } from '@/utils/logger';

interface OAuthCode {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  expiresAt: Date;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export class OAuthProviderService {
  private static instance: OAuthProviderService;
  private readonly jwtSecret: string;
  private readonly authCodes = new Map<string, OAuthCode>();

  // OAuth client configuration for Claude products
  private readonly clients = {
    'claude-ai': {
      clientSecret: process.env.CLAUDE_AI_CLIENT_SECRET || 'development-secret',
      redirectUris: [
        'https://claude.ai/oauth/callback',
        'https://*.claude.ai/oauth/callback',
        'https://claude.ai/mcp/oauth/callback',
        'https://*.claude.ai/mcp/oauth/callback',
        'https://claude.ai/settings/integrations/mcp/oauth/callback',
        'https://*.claude.ai/settings/integrations/mcp/oauth/callback',
        'https://claude.ai/api/organizations/*/integrations/remote-mcp-oauth/callback',
        'https://*.claude.ai/api/organizations/*/integrations/remote-mcp-oauth/callback',
      ],
      allowedScopes: ['read', 'write', 'profile', 'openid'],
    },
    'claude-desktop': {
      clientSecret: process.env.CLAUDE_DESKTOP_CLIENT_SECRET || 'development-secret',
      redirectUris: ['http://localhost/oauth/callback', 'claude-desktop://oauth/callback'],
      allowedScopes: ['read', 'write', 'profile', 'openid'],
    },
    'claude-code': {
      clientSecret: process.env.CLAUDE_CODE_CLIENT_SECRET || 'development-secret',
      redirectUris: [
        'vscode://claude-code/oauth/callback', 
        'cursor://claude-code/oauth/callback',
        'http://localhost:*/callback',
        'http://127.0.0.1:*/callback'
      ],
      allowedScopes: ['read', 'write', 'profile', 'openid'],
    },
    'mcp-client': {
      clientSecret: process.env.MCP_CLIENT_SECRET || 'development-secret',
      redirectUris: [
        'https://claude.ai/oauth/callback',
        'https://*.claude.ai/oauth/callback',
        'https://claude.ai/mcp/oauth/callback',
        'https://*.claude.ai/mcp/oauth/callback',
        'https://claude.ai/settings/integrations/mcp/oauth/callback',
        'https://*.claude.ai/settings/integrations/mcp/oauth/callback',
        'https://claude.ai/api/organizations/*/integrations/remote-mcp-oauth/callback',
        'https://*.claude.ai/api/organizations/*/integrations/remote-mcp-oauth/callback',
        'http://localhost:*/oauth/callback',
        'http://127.0.0.1:*/oauth/callback',
      ],
      allowedScopes: ['read', 'write', 'profile', 'openid'],
    },
  };

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'development-secret-change-in-production';

    // Clean up expired auth codes every 5 minutes
    setInterval(
      () => {
        const now = new Date();
        for (const [code, data] of this.authCodes.entries()) {
          if (data.expiresAt < now) {
            this.authCodes.delete(code);
          }
        }
      },
      5 * 60 * 1000,
    );
  }

  static getInstance(): OAuthProviderService {
    if (!OAuthProviderService.instance) {
      OAuthProviderService.instance = new OAuthProviderService();
    }
    return OAuthProviderService.instance;
  }

  // Step 1: Authorization endpoint - Generate auth code
  async authorize(params: {
    clientId: string;
    redirectUri: string;
    scope: string;
    state?: string;
    userId: string; // User must be authenticated already via Google/GitHub
    codeChallenge?: string;
    codeChallengeMethod?: string;
  }): Promise<{ redirectUrl: string }> {
    const { clientId, redirectUri, scope, state, userId, codeChallenge, codeChallengeMethod } =
      params;

    // Validate client - check static clients first
    let client = this.clients[clientId as keyof typeof this.clients];
    
    // If not a static client, check if it's a dynamically registered client
    if (!client) {
      // For MCP Inspector and other dynamic clients, allow any redirect URI for now
      // TODO: In production, validate against stored client registrations
      if (clientId.startsWith('mcp-')) {
        client = {
          clientSecret: 'dynamic-client-secret', // Not used with PKCE
          redirectUris: [redirectUri], // Allow the provided redirect URI
          allowedScopes: ['read', 'write', 'profile', 'openid'],
        };
      } else {
        throw new Error('Invalid client_id');
      }
    }

    // Validate redirect URI
    const isValidRedirect = client.redirectUris.some(uri => {
      if (uri.includes('*')) {
        const pattern = uri.replace('*', '.*');
        return new RegExp(pattern).test(redirectUri);
      }
      return uri === redirectUri;
    });

    if (!isValidRedirect) {
      throw new Error('Invalid redirect_uri');
    }

    // Validate scope
    const requestedScopes = scope.split(' ');
    const invalidScopes = requestedScopes.filter(s => !client.allowedScopes.includes(s));
    if (invalidScopes.length > 0) {
      throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`);
    }

    // Validate PKCE parameters if provided
    if (codeChallenge) {
      if (!codeChallengeMethod || codeChallengeMethod !== 'S256') {
        throw new Error('code_challenge_method must be S256');
      }
      if (codeChallenge.length < 43 || codeChallenge.length > 128) {
        throw new Error('Invalid code_challenge length');
      }
    }

    // Generate authorization code
    const code = randomBytes(32).toString('base64url');
    const authCode: OAuthCode = {
      code,
      clientId,
      userId,
      redirectUri,
      scope,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      codeChallenge,
      codeChallengeMethod,
    };

    this.authCodes.set(code, authCode);
    
    logger.info('Authorization code stored', {
      code,
      clientId,
      userId,
      codeChallenge: !!codeChallenge,
      totalCodes: this.authCodes.size,
    });

    // Build redirect URL
    const url = new URL(redirectUri);
    url.searchParams.append('code', code);
    if (state) {
      url.searchParams.append('state', state);
    }

    return { redirectUrl: url.toString() };
  }

  // Step 2: Token endpoint - Exchange code for tokens
  async token(params: {
    grantType: string;
    code?: string;
    refreshToken?: string;
    clientId: string;
    clientSecret?: string;
    redirectUri?: string;
    codeVerifier?: string;
  }): Promise<OAuthToken> {
    const { grantType, code, refreshToken, clientId, clientSecret, redirectUri, codeVerifier } =
      params;
      
    logger.info('OAuth token request', {
      grantType,
      clientId,
      hasCode: !!code,
      hasCodeVerifier: !!codeVerifier,
      redirectUri,
    });

    // Validate client - check static clients first
    let client = this.clients[clientId as keyof typeof this.clients];
    
    // If not a static client, check if it's a dynamically registered client
    if (!client) {
      // For MCP Inspector and other dynamic clients, allow any redirect URI for now
      // TODO: In production, validate against stored client registrations
      if (clientId.startsWith('mcp-')) {
        client = {
          clientSecret: 'dynamic-client-secret', // Not used with PKCE
          redirectUris: redirectUri ? [redirectUri] : ['http://localhost:*'], // Allow the provided redirect URI
          allowedScopes: ['read', 'write', 'profile', 'openid'],
        };
      } else {
        throw new Error('Invalid client_id');
      }
    }

    // For authorization_code grant with PKCE, client_secret is optional
    // Also skip client secret validation for dynamic MCP clients
    if (grantType === 'authorization_code' && codeVerifier) {
      // Public client with PKCE - no client secret required
    } else if (clientId.startsWith('mcp-')) {
      // Dynamic MCP client - skip client secret validation
    } else if (client.clientSecret !== clientSecret) {
      // Confidential client - client secret required
      throw new Error('Invalid client credentials');
    }

    if (grantType === 'authorization_code') {
      if (!code || !redirectUri) {
        throw new Error('Missing code or redirect_uri');
      }

      // Validate auth code
      const authCode = this.authCodes.get(code);
      logger.info('Auth code lookup', {
        code,
        found: !!authCode,
        storedCodes: Array.from(this.authCodes.keys()).length,
      });
      
      if (!authCode) {
        throw new Error('Invalid or expired authorization code');
      }

      if (authCode.clientId !== clientId || authCode.redirectUri !== redirectUri) {
        throw new Error('Invalid authorization code');
      }

      if (authCode.expiresAt < new Date()) {
        this.authCodes.delete(code);
        throw new Error('Authorization code expired');
      }

      // Verify PKCE if used
      if (authCode.codeChallenge) {
        if (!codeVerifier) {
          throw new Error('code_verifier required');
        }

        // Verify code_verifier against code_challenge
        const challenge = createHash('sha256').update(codeVerifier).digest('base64url');
        
        logger.info('PKCE verification', {
          providedVerifier: codeVerifier,
          calculatedChallenge: challenge,
          expectedChallenge: authCode.codeChallenge,
          matches: challenge === authCode.codeChallenge,
        });

        if (challenge !== authCode.codeChallenge) {
          throw new Error('Invalid code_verifier');
        }
      }

      // Delete code (one-time use)
      this.authCodes.delete(code);

      // Generate tokens
      const accessToken = this.generateAccessToken(authCode.userId, authCode.scope);
      const refreshTokenValue = this.generateRefreshToken(authCode.userId, authCode.scope);

      // Store refresh token
      await prisma.refreshToken.create({
        data: {
          token: createHash('sha256').update(refreshTokenValue).digest('hex'),
          userId: authCode.userId,
          clientId,
          scope: authCode.scope,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600, // 1 hour
        refresh_token: refreshTokenValue,
        scope: authCode.scope,
      };
    } else if (grantType === 'refresh_token') {
      if (!refreshToken) {
        throw new Error('Missing refresh_token');
      }

      // Validate refresh token
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: tokenHash },
        include: { user: true },
      });

      if (!storedToken || storedToken.clientId !== clientId) {
        throw new Error('Invalid refresh token');
      }

      if (storedToken.expiresAt < new Date() || storedToken.revokedAt) {
        throw new Error('Refresh token expired or revoked');
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(storedToken.userId, storedToken.scope);

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: storedToken.scope,
      };
    } else {
      throw new Error('Unsupported grant_type');
    }
  }

  // Generate access token (JWT)
  private generateAccessToken(userId: string, scope: string): string {
    return jwt.sign(
      {
        userId,
        sub: userId,
        scope,
        type: 'access',
      },
      this.jwtSecret,
      {
        expiresIn: '1h',
        issuer: 'federated-memory',
      },
    );
  }

  // Generate refresh token
  private generateRefreshToken(_userId: string, _scope: string): string {
    return randomBytes(32).toString('base64url');
  }

  // Validate access token
  async validateAccessToken(token: string): Promise<{ userId: string; scope: string } | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'federated-memory',
      }) as any;

      if (decoded.type !== 'access') {
        return null;
      }

      // Check if user is still active
      const userId = decoded.userId || decoded.sub;
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.isActive) {
        return null;
      }

      return {
        userId,
        scope: decoded.scope,
      };
    } catch (error) {
      return null;
    }
  }

  // Revoke refresh token
  async revokeToken(refreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await prisma.refreshToken.update({
      where: { token: tokenHash },
      data: { revokedAt: new Date() },
    });
  }
}
