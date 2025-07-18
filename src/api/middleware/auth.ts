import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/services/auth.service';
import { Logger } from '@/utils/logger';

const logger = Logger.getInstance();
const authService = AuthService.getInstance();

// AuthRequest now uses the Express User type defined in types/express.d.ts
export interface AuthRequest extends Request {}

/**
 * Authentication middleware using BigMemory UUID token pattern
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Support both header and query parameter authentication
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
    
    // Validate token format (UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      res.status(401).json({
        error: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
      return;
    }
    
    // Validate token and get user
    const result = await authService.validateToken(token);
    
    if (!result) {
      res.status(401).json({
        error: 'Invalid authentication token',
        code: 'INVALID_TOKEN'
      });
      return;
    }
    
    // Get full user details
    const user = await authService.getUserById(result.userId);
    
    if (!user) {
      res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }
    
    // Attach user to request for downstream use
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      metadata: (user as any).metadata
    };
    req.userId = user.id; // Convenience property
    
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
      // Validate token format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(token)) {
        const result = await authService.validateToken(token);
        if (result) {
          const user = await authService.getUserById(result.userId);
          if (user) {
            req.user = {
              id: user.id,
              email: user.email,
              name: user.name,
              avatarUrl: user.avatarUrl,
              metadata: (user as any).metadata
            };
            req.userId = user.id;
          }
        }
      }
    }
    
    next();
  } catch (error) {
    // Log error but continue - this is optional auth
    logger.debug('Optional auth error', { error });
    next();
  }
}