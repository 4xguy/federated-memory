import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { logger } from '@/utils/logger';

/**
 * Middleware to check if OAuth strategy is available before attempting authentication
 */
export function checkOAuthStrategy(strategy: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if the strategy exists in passport
    const strategyExists = (passport as any)._strategies[strategy];
    
    if (!strategyExists) {
      logger.warn(`OAuth strategy ${strategy} not available - credentials not configured`);
      
      // If it's an API request, return JSON error
      if (req.path.includes('/api/')) {
        return res.status(503).json({
          error: 'OAuth provider not configured',
          message: `${strategy} authentication is not available. OAuth credentials have not been configured.`
        });
      }
      
      // Otherwise redirect to an error page
      return res.redirect(`/auth/unavailable?provider=${strategy}`);
    }
    
    next();
  };
}