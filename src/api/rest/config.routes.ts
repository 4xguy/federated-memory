import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * GET /api/config
 * Returns MCP server configuration for Claude.ai
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    // Set CORS headers for Claude.ai
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    res.json({
      mcp: {
        version: '1.0.0',
        serverInfo: {
          name: 'federated-memory',
          version: '1.0.0',
          description: 'Distributed memory system for LLMs with intelligent routing',
        },
        capabilities: {
          tools: true,
          resources: false,
          prompts: true,
          sampling: false,
        },
        transport: {
          type: 'streamable-http',
          endpoint: `${baseUrl}/sse`,
        },
        auth: {
          type: 'oauth2',
          authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
          token_endpoint: `${baseUrl}/api/oauth/token`,
          scopes_supported: ['read', 'write', 'profile'],
          code_challenge_methods_supported: ['S256'],
        },
      },
    });
  } catch (error) {
    logger.error('Error serving config endpoint', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Handle OPTIONS preflight requests
 */
router.options('/', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).send();
});

export default router;