import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

/**
 * Middleware to handle OAuth responses for MCP requests
 * This intercepts JSON-RPC errors and adds proper HTTP headers for OAuth
 */
export function mcpOAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // Store the original json method
  const originalJson = res.json.bind(res);

  // Override the json method to intercept OAuth errors
  res.json = function(body: any) {
    // Check if this is an OAuth error response
    if (body?.error?.code === -32001 || body?.error?.data?.type === 'oauth_required') {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      
      // Set proper status code and headers for OAuth
      res.status(401);
      res.setHeader(
        'WWW-Authenticate',
        `Bearer realm="${baseUrl}", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`
      );
      
      logger.info('MCP OAuth error intercepted, sending 401 with WWW-Authenticate header');
    }

    // Call the original json method
    return originalJson(body);
  };

  next();
}