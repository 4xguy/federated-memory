import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { AuthService } from '@/services/auth.service';
import { logger } from '@/utils/logger';

const authService = AuthService.getInstance();

export function initializeGitHubStrategy() {
  // Check if GitHub OAuth credentials are configured
  const clientID = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientID || !clientSecret || clientID === 'placeholder-github-client-id') {
    logger.warn('GitHub OAuth not configured - skipping strategy initialization');
    return false;
  }

  // Construct callback URL - prefer explicit env var, then construct from BASE_URL, then fallback
  let callbackURL = process.env.GITHUB_CALLBACK_URL;
  
  if (!callbackURL) {
    const baseUrl = process.env.BASE_URL;
    if (baseUrl) {
      callbackURL = `${baseUrl}/api/auth/github/callback`;
    } else {
      callbackURL = '/api/auth/github/callback'; // This should only be used in development
    }
  }

  logger.info('GitHub OAuth callback URL configured', { callbackURL });

  passport.use(
    new GitHubStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        scope: ['user:email'],
      },
      async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
        try {
          // Extract user information from GitHub profile
          const oauthProfile = {
            id: profile.id,
            email: profile.emails?.[0]?.value || profile._json?.email || '',
            name: profile.displayName || profile.username,
            avatar: profile.photos?.[0]?.value || profile._json?.avatar_url,
            provider: 'github' as const,
          };

          logger.info('GitHub OAuth profile', {
            id: oauthProfile.id,
            email: oauthProfile.email,
            name: oauthProfile.name,
          });

          // Find or create user in database
          const user = await authService.findOrCreateOAuthUser(oauthProfile);

          return done(null, user);
        } catch (error) {
          logger.error('GitHub OAuth error', { error });
          return done(error as Error);
        }
      },
    ),
  );

  return true;
}