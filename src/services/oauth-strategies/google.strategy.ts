import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { AuthService } from '@/services/auth.service';
import { logger } from '@/utils/logger';

const authService = AuthService.getInstance();

export function initializeGoogleStrategy() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
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
}