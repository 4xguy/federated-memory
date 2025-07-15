import passport from 'passport';
import { prisma } from '@/utils/database';
import { initializeGoogleStrategy } from './google.strategy';
import { initializeGitHubStrategy } from './github.strategy';
import { logger } from '@/utils/logger';

export function initializePassport() {
  // Initialize strategies
  const googleEnabled = initializeGoogleStrategy();
  const githubEnabled = initializeGitHubStrategy();

  if (!googleEnabled && !githubEnabled) {
    logger.warn('No OAuth strategies configured - OAuth login will be unavailable');
  } else {
    const strategies = [];
    if (googleEnabled) strategies.push('Google');
    if (githubEnabled) strategies.push('GitHub');
    logger.info(`OAuth strategies enabled: ${strategies.join(', ')}`);
  }

  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          oauthProvider: true,
        },
      });
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  return passport;
}