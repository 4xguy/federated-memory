import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';

const router = Router();

// MCP OAuth Discovery endpoint
// This helps MCP clients understand how to authenticate
router.get('/mcp/oauth', (req: Request, res: Response) => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  
  res.json({
    type: 'oauth2',
    authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
    token_endpoint: `${baseUrl}/api/oauth/token`,
    client_id: 'mcp-client',
    scopes: ['read', 'write'],
    response_type: 'code',
    code_challenge_method: 'S256',
    metadata: {
      issuer: baseUrl,
      authorization_server: `${baseUrl}/.well-known/oauth-authorization-server`,
      protected_resource: `${baseUrl}/.well-known/oauth-protected-resource`,
    },
  });
});

// MCP-specific OAuth initiation endpoint
// This endpoint can be called by MCP clients to start the OAuth flow
router.post('/mcp/oauth/initiate', (req: Request, res: Response) => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const { redirect_uri, state } = req.body;
  
  // Generate OAuth URL with MCP-specific parameters
  const authUrl = new URL(`${baseUrl}/api/oauth/authorize`);
  authUrl.searchParams.append('client_id', 'mcp-client');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', redirect_uri || 'https://claude.ai/oauth/callback');
  authUrl.searchParams.append('scope', 'read write');
  if (state) authUrl.searchParams.append('state', state);
  
  res.json({
    authorization_url: authUrl.toString(),
    requires_pkce: true,
  });
});

export default router;