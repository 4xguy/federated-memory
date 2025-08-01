import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { AuthService } from '@/services/auth.service';
import { logger } from '@/utils/logger';

const authService = AuthService.getInstance();

export function initializeGoogleStrategy() {
  // Check if Google OAuth credentials are configured
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret || clientID === 'placeholder-google-client-id') {
    logger.warn('Google OAuth not configured - skipping strategy initialization');
    return false;
  }

  // Construct callback URL - prefer explicit env var, then construct from BASE_URL, then fallback
  let callbackURL = process.env.GOOGLE_CALLBACK_URL;
  
  if (!callbackURL) {
    const baseUrl = process.env.BASE_URL;
    if (baseUrl) {
      callbackURL = `${baseUrl}/api/auth/google/callback`;
    } else {
      callbackURL = '/api/auth/google/callback'; // This should only be used in development
    }
  }

  logger.info('Google OAuth callback URL configured', { callbackURL });

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          // Extract user information from Google profile
          const oauthProfile = {
            id: profile.id,
            email: profile.emails?.[0]?.value || '',
            name: profile.displayName,
            avatar: profile.photos?.[0]?.value,
            provider: 'google' as const,
          };

          logger.info('Google OAuth profile', {
            id: oauthProfile.id,
            email: oauthProfile.email,
            name: oauthProfile.name,
          });

          // Find or create user in database
          const user = await authService.findOrCreateOAuthUser(oauthProfile);

          return done(null, user);
        } catch (error) {
          logger.error('Google OAuth error', { error });
          return done(error as Error);
        }
      },
    ),
  );

  return true;
}