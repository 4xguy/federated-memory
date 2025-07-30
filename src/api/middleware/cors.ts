import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

/**
 * Custom CORS middleware for auth endpoints
 * Ensures CORS headers are always set, even on errors
 */
export function authCorsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin || '*';
  
  // List of allowed origins
  const allowedOrigins = [
    'https://charming-mercy-production.up.railway.app',
    'https://federated-memory-production.up.railway.app',
    'https://fm.clauvin.com',
    'https://fmbe.clauvin.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'https://claude.ai',
    'https://*.claude.ai',
    'https://*.up.railway.app',
  ];
  
  // Check if origin is allowed
  const isAllowed = allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const regex = new RegExp(allowed.replace('*', '.*'));
      return regex.test(origin);
    }
    return allowed === origin;
  });
  
  if (isAllowed || origin === '*') {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    logger.warn('CORS: Rejected origin', { origin });
    res.setHeader('Access-Control-Allow-Origin', 'https://charming-mercy-production.up.railway.app');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
}