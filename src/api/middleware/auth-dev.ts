import { Request, Response, NextFunction } from 'express';
import { Logger } from '@/utils/logger';

const logger = Logger.getInstance();

export interface AuthRequest extends Request {}

/**
 * Development authentication middleware for testing
 * Accepts temporary tokens from frontend NextAuth sessions
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || 
                  (req.query.token as string);
    
    if (!token) {
      res.status(401).json({
        error: 'No authentication token provided',
        code: 'NO_TOKEN'
      });
      return;
    }
    
    // Check if it's a temporary development token
    if (token.startsWith('temp-')) {
      try {
        const base64Data = token.substring(5); // Remove 'temp-' prefix
        const userData = JSON.parse(Buffer.from(base64Data, 'base64').toString());
        
        // Attach user to request for downstream use
        req.user = {
          id: userData.userId || userData.email || 'dev-user',
          email: userData.email || 'dev@example.com',
          name: userData.name || 'Development User',
          avatarUrl: null,
          metadata: {}
        };
        req.userId = req.user.id;
        
        logger.debug('Development auth successful', { userId: req.user.id });
        next();
        return;
      } catch (error) {
        logger.error('Failed to parse temp token', { error });
        res.status(401).json({
          error: 'Invalid temp token',
          code: 'INVALID_TEMP_TOKEN'
        });
        return;
      }
    }
    
    // For production tokens, validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      res.status(401).json({
        error: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
      return;
    }
    
    // In development, accept any valid UUID as a token
    req.user = {
      id: token,
      email: 'dev@example.com',
      name: 'Development User',
      avatarUrl: null,
      metadata: {}
    };
    req.userId = token;
    
    next();
  } catch (error) {
    logger.error('Authentication error', { error });
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Optional auth middleware - attaches user if token is present but doesn't require it
 */
export async function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || 
                  (req.query.token as string);
    
    if (token) {
      // Reuse the main auth logic but don't fail on errors
      authMiddleware(req, res, () => {
        next();
      });
    } else {
      next();
    }
  } catch (error) {
    // Log error but continue - this is optional auth
    logger.debug('Optional auth error', { error });
    next();
  }
}