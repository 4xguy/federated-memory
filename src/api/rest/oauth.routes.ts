import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { OAuthProviderService } from '@/services/oauth-provider.service';
import { AuthService } from '@/services/auth.service';
import { logger } from '@/utils/logger';
import { AuthRequest } from '@/types/auth';

const router = Router();
const oauthProvider = OAuthProviderService.getInstance();
const authService = AuthService.getInstance();

// OAuth 2.0 Authorization Server Metadata (RFC 8414)
router.get('/.well-known/oauth-authorization-server', (req: Request, res: Response) => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
    token_endpoint: `${baseUrl}/api/oauth/token`,
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    token_endpoint_auth_signing_alg_values_supported: ['RS256'],
    userinfo_endpoint: `${baseUrl}/api/oauth/userinfo`,
    jwks_uri: `${baseUrl}/api/oauth/jwks`,
    registration_endpoint: `${baseUrl}/api/oauth/register`,
    scopes_supported: ['read', 'write', 'profile', 'openid'],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    revocation_endpoint: `${baseUrl}/api/oauth/revoke`,
    revocation_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    introspection_endpoint: `${baseUrl}/api/oauth/introspect`,
    introspection_endpoint_auth_methods_supported: ['client_secret_post', 'bearer'],
    service_documentation: 'https://github.com/yourusername/federated-memory',
    ui_locales_supported: ['en-US'],
  });
});

// OAuth 2.0 Protected Resource Metadata
router.get('/.well-known/oauth-protected-resource', (req: Request, res: Response) => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

  res.json({
    resource_server: baseUrl,
    authorization_servers: [baseUrl],
    scopes_supported: ['read', 'write', 'profile'],
    bearer_methods_supported: ['header', 'query'],
    resource_documentation: 'https://github.com/yourusername/federated-memory',
  });
});

// OAuth authorization endpoint
const authorizeSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string(),
  redirect_uri: z.string(), // Remove .url() validation to allow localhost URLs
  scope: z.string().optional(), // Make scope fully optional
  state: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.literal('S256').optional(),
});

router.get('/authorize', async (req: AuthRequest, res: Response) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    const queryClientId = req.query.client_id as string;
    
    // Special handling for MCP Inspector and dynamic clients
    if (queryClientId && queryClientId.startsWith('mcp-')) {
      // For MCP clients, we'll auto-approve without requiring login
      // In production, you'd want proper authentication here
      const validation = authorizeSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: validation.error.errors[0].message,
        });
      }

      const validatedData = validation.data;

      // For MCP clients, redirect to Google OAuth for authentication
      // Store the OAuth request params in session to use after authentication
      req.session = req.session || {};
      req.session.oauthRequest = {
        clientId: validatedData.client_id,
        redirectUri: validatedData.redirect_uri,
        scope: validatedData.scope || 'read write',
        state: validatedData.state,
        codeChallenge: validatedData.code_challenge,
        codeChallengeMethod: validatedData.code_challenge_method,
      };
      
      // Redirect to Google OAuth
      return res.redirect('/api/auth/google');
    }
    
    // Regular flow for other clients
    if (!req.user) {
      // Redirect to login with return URL
      const loginUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:3001');
      loginUrl.pathname = '/login';
      loginUrl.searchParams.append('return_to', req.originalUrl);
      return res.redirect(loginUrl.toString());
    }

    const validation = authorizeSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: validation.error.errors[0].message,
      });
    }

    const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method } =
      validation.data;

    // Show consent screen (in production, you'd render a proper consent page)
    if (!req.query.consent) {
      const consentUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:3001');
      consentUrl.pathname = '/oauth/consent';
      consentUrl.searchParams.append('client_id', client_id);
      consentUrl.searchParams.append('redirect_uri', redirect_uri);
      consentUrl.searchParams.append('scope', scope || 'read write');
      if (state) consentUrl.searchParams.append('state', state);
      if (code_challenge) consentUrl.searchParams.append('code_challenge', code_challenge);
      if (code_challenge_method)
        consentUrl.searchParams.append('code_challenge_method', code_challenge_method);
      return res.redirect(consentUrl.toString());
    }

    // Generate authorization code
    const { redirectUrl } = await oauthProvider.authorize({
      clientId: client_id,
      redirectUri: redirect_uri,
      scope: scope || 'read write', // Default scope if not provided
      state,
      userId: req.user.id,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
    });

    return res.redirect(redirectUrl);
  } catch (error) {
    logger.error('OAuth authorize error', { error });
    return res.status(400).json({
      error: 'invalid_request',
      error_description: error instanceof Error ? error.message : 'Authorization failed',
    });
  }
});

// Handle OPTIONS for token endpoint
router.options('/token', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).send();
});

// OAuth token endpoint
const tokenSchema = z.object({
  grant_type: z.enum(['authorization_code', 'refresh_token']),
  code: z.string().optional(),
  refresh_token: z.string().optional(),
  client_id: z.string(),
  client_secret: z.string().optional(), // Optional for PKCE
  redirect_uri: z.string().optional(), // Remove .url() validation to allow localhost URLs
  code_verifier: z.string().optional(), // PKCE verifier
});

router.post('/token', async (req: Request, res: Response) => {
  // Set CORS headers explicitly
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Log raw request for debugging
  logger.info('Token endpoint raw request', {
    headers: req.headers,
    body: req.body,
    contentType: req.headers['content-type'],
  });
  
  try {
    const validation = tokenSchema.safeParse(req.body);
    if (!validation.success) {
      logger.error('Token request validation failed', {
        errors: validation.error.errors,
        body: req.body,
      });
      
      const errorDetail = validation.error.errors[0];
      const fieldPath = errorDetail.path.join('.');
      const errorMessage = fieldPath ? `${fieldPath}: ${errorDetail.message}` : errorDetail.message;
      
      return res.status(400).json({
        error: 'invalid_request',
        error_description: errorMessage,
      });
    }

    const token = await oauthProvider.token({
      grantType: validation.data.grant_type,
      code: validation.data.code,
      refreshToken: validation.data.refresh_token,
      clientId: validation.data.client_id,
      clientSecret: validation.data.client_secret,
      redirectUri: validation.data.redirect_uri,
      codeVerifier: validation.data.code_verifier,
    });

    return res.json(token);
  } catch (error) {
    logger.error('OAuth token error', { 
      error,
      body: req.body,
      clientId: req.body.client_id,
      grantType: req.body.grant_type
    });
    
    // Ensure CORS headers are set even on error
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: error instanceof Error ? error.message : 'Token generation failed',
    });
  }
});

// Revoke token endpoint
router.post('/revoke', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing token parameter',
      });
    }

    await oauthProvider.revokeToken(token);
    return res.status(200).send();
  } catch (error) {
    logger.error('OAuth revoke error', { error });
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Failed to revoke token',
    });
  }
});

// Dynamic Client Registration endpoint (RFC 7591)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      client_name,
      redirect_uris,
      grant_types = ['authorization_code'],
      application_type = 'web',
      scope = 'read write profile',
    } = req.body;

    if (!client_name || !redirect_uris || !Array.isArray(redirect_uris)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_name and redirect_uris are required',
      });
    }

    // Generate a unique client ID
    const clientId = `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    const clientSecret = `secret-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;

    // TODO: In production, store this client registration in the database
    // For now, we'll return a response that allows the client to proceed
    const response = {
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0, // Never expires
      redirect_uris,
      grant_types,
      application_type,
      client_name,
      scope,
      token_endpoint_auth_method: 'client_secret_post',
    };

    logger.info('Dynamic client registered', { clientId, client_name });
    return res.status(201).json(response);
  } catch (error) {
    logger.error('Dynamic client registration error', { error });
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Failed to register client',
    });
  }
});

export default router;
