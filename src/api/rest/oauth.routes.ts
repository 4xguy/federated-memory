import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { OAuthProviderService } from '@/services/oauth-provider.service';
import { AuthService } from '@/services/auth.service';
import { logger } from '@/utils/logger';
import { AuthRequest } from '@/types/auth';

const router = Router();
const oauthProvider = OAuthProviderService.getInstance();
const authService = AuthService.getInstance();

// OAuth authorization endpoint
const authorizeSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  scope: z.string(),
  state: z.string().optional(),
});

router.get('/authorize', async (req: AuthRequest, res: Response) => {
  try {
    // User must be authenticated (via session from frontend)
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

    const { client_id, redirect_uri, scope, state } = validation.data;

    // Show consent screen (in production, you'd render a proper consent page)
    if (!req.query.consent) {
      const consentUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:3001');
      consentUrl.pathname = '/oauth/consent';
      consentUrl.searchParams.append('client_id', client_id);
      consentUrl.searchParams.append('redirect_uri', redirect_uri);
      consentUrl.searchParams.append('scope', scope);
      if (state) consentUrl.searchParams.append('state', state);
      return res.redirect(consentUrl.toString());
    }

    // Generate authorization code
    const { redirectUrl } = await oauthProvider.authorize({
      clientId: client_id,
      redirectUri: redirect_uri,
      scope,
      state,
      userId: req.user.id,
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

// OAuth token endpoint
const tokenSchema = z.object({
  grant_type: z.enum(['authorization_code', 'refresh_token']),
  code: z.string().optional(),
  refresh_token: z.string().optional(),
  client_id: z.string(),
  client_secret: z.string(),
  redirect_uri: z.string().url().optional(),
});

router.post('/token', async (req: Request, res: Response) => {
  try {
    const validation = tokenSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: validation.error.errors[0].message,
      });
    }

    const token = await oauthProvider.token({
      grantType: validation.data.grant_type,
      code: validation.data.code,
      refreshToken: validation.data.refresh_token,
      clientId: validation.data.client_id,
      clientSecret: validation.data.client_secret,
      redirectUri: validation.data.redirect_uri,
    });

    return res.json(token);
  } catch (error) {
    logger.error('OAuth token error', { error });
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

export default router;