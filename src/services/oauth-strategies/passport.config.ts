import passport from 'passport';
import { prisma } from '@/utils/database';
import { initializeGoogleStrategy } from './google.strategy';
import { initializeGitHubStrategy } from './github.strategy';

export function initializePassport() {
  // Initialize strategies
  initializeGoogleStrategy();
  initializeGitHubStrategy();

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