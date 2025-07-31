import { Router, Request, Response } from 'express';
import passport from 'passport';
import { AuthService } from '@/services/auth.service';
import { logger } from '@/utils/logger';
import { checkOAuthStrategy } from '@/api/middleware/oauth-check';

const router = Router();
const authService = AuthService.getInstance();

// Google OAuth routes
router.get(
  '/google',
  checkOAuthStrategy('google'),
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  }),
);

router.get(
  '/google/callback',
  checkOAuthStrategy('google'),
  passport.authenticate('google', { failureRedirect: '/auth/failed' }),
  async (req: Request, res: Response) => {
    try {
      // User is authenticated via Google
      const user = req.user as any;
      
      // Check if this is part of an MCP OAuth flow
      if (req.session?.oauthRequest) {
        const oauthRequest = req.session.oauthRequest;
        
        // Import OAuthProviderService
        const { OAuthProviderService } = await import('@/services/oauth-provider.service');
        const oauthProvider = OAuthProviderService.getInstance();
        
        // Generate authorization code for the MCP client
        const { redirectUrl } = await oauthProvider.authorize({
          clientId: oauthRequest.clientId,
          redirectUri: oauthRequest.redirectUri,
          scope: oauthRequest.scope,
          state: oauthRequest.state,
          userId: user.id, // Use the actual authenticated user
          codeChallenge: oauthRequest.codeChallenge,
          codeChallengeMethod: oauthRequest.codeChallengeMethod,
        });
        
        // Clear the OAuth request from session
        delete req.session.oauthRequest;
        
        logger.info('MCP OAuth flow completed via Google', { userId: user.id, clientId: oauthRequest.clientId });
        
        return res.redirect(redirectUrl);
      }
      
      // Regular web login flow - use UUID token
      const userRecord = await authService.getUserById(user.id);
      if (!userRecord) {
        throw new Error('User not found after OAuth');
      }
      
      // Redirect to frontend with UUID token
      const frontendUrl = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:3001';
      
      logger.info('Google OAuth redirect configuration', { 
        FRONTEND_URL: process.env.FRONTEND_URL,
        BASE_URL: process.env.BASE_URL,
        frontendUrl,
        userId: user.id 
      });
      
      const redirectUrl = new URL(`${frontendUrl}/auth/success`);
      redirectUrl.searchParams.append('token', userRecord.token);
      redirectUrl.searchParams.append('provider', 'google');
      
      logger.info('Google OAuth success', { 
        userId: user.id, 
        email: user.email,
        redirectTo: redirectUrl.toString() 
      });
      
      res.redirect(redirectUrl.toString());
    } catch (error) {
      logger.error('Google OAuth callback error', { error });
      const frontendUrl = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/auth/failed`);
    }
  },
);

// GitHub OAuth routes
router.get(
  '/github',
  checkOAuthStrategy('github'),
  passport.authenticate('github', {
    scope: ['user:email'],
  }),
);

router.get(
  '/github/callback',
  checkOAuthStrategy('github'),
  passport.authenticate('github', { failureRedirect: '/auth/failed' }),
  async (req: Request, res: Response) => {
    try {
      // User is authenticated via GitHub
      const user = req.user as any;
      
      // Check if this is part of an MCP OAuth flow
      if (req.session?.oauthRequest) {
        const oauthRequest = req.session.oauthRequest;
        
        // Import OAuthProviderService
        const { OAuthProviderService } = await import('@/services/oauth-provider.service');
        const oauthProvider = OAuthProviderService.getInstance();
        
        // Generate authorization code for the MCP client
        const { redirectUrl } = await oauthProvider.authorize({
          clientId: oauthRequest.clientId,
          redirectUri: oauthRequest.redirectUri,
          scope: oauthRequest.scope,
          state: oauthRequest.state,
          userId: user.id, // Use the actual authenticated user
          codeChallenge: oauthRequest.codeChallenge,
          codeChallengeMethod: oauthRequest.codeChallengeMethod,
        });
        
        // Clear the OAuth request from session
        delete req.session.oauthRequest;
        
        logger.info('MCP OAuth flow completed via GitHub', { userId: user.id, clientId: oauthRequest.clientId });
        
        return res.redirect(redirectUrl);
      }
      
      // Regular web login flow - use UUID token
      const userRecord = await authService.getUserById(user.id);
      if (!userRecord) {
        throw new Error('User not found after OAuth');
      }
      
      // Redirect to frontend with UUID token
      const frontendUrl = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:3001';
      
      logger.info('GitHub OAuth redirect configuration', { 
        FRONTEND_URL: process.env.FRONTEND_URL,
        BASE_URL: process.env.BASE_URL,
        frontendUrl,
        userId: user.id 
      });
      const redirectUrl = new URL(`${frontendUrl}/auth/success`);
      redirectUrl.searchParams.append('token', userRecord.token);
      redirectUrl.searchParams.append('provider', 'github');
      
      logger.info('GitHub OAuth success', { userId: user.id, email: user.email });
      
      res.redirect(redirectUrl.toString());
    } catch (error) {
      logger.error('GitHub OAuth callback error', { error });
      const frontendUrl = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:3001';
      res.redirect(`${frontendUrl}/auth/failed`);
    }
  },
);

// Logout route
router.post('/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      logger.error('Logout error', { error: err });
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// Get current user info
router.get('/me', (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const user = req.user as any;
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    provider: user.oauthProvider,
  });
});

// OAuth failure route
router.get('/failed', (_req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  res.redirect(`${frontendUrl}/auth/failed`);
});

export default router;