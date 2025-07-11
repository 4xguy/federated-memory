export class AuthenticationRequiredError extends Error {
  public code: number;
  public data: any;
  public httpStatusCode: number;
  public httpHeaders: Record<string, string>;

  constructor(baseUrl?: string) {
    super('Authentication required');
    this.name = 'AuthenticationRequiredError';
    this.code = -32001; // Custom error code for auth required
    this.httpStatusCode = 401;
    
    const url = baseUrl || process.env.BASE_URL || 'http://localhost:3000';
    
    // Set WWW-Authenticate header as per MCP OAuth spec
    this.httpHeaders = {
      'WWW-Authenticate': `Bearer realm="${url}", resource_metadata="${url}/.well-known/oauth-protected-resource"`,
    };
    
    this.data = {
      type: 'oauth_required',
      message: 'Authentication required. Please follow the OAuth flow.',
      resource_metadata_url: `${url}/.well-known/oauth-protected-resource`,
    };
  }
}

export function createAuthRequiredResponse(baseUrl?: string) {
  const url = baseUrl || process.env.BASE_URL || 'http://localhost:3000';
  return {
    error: {
      code: -32001,
      message: 'Authentication required',
      data: {
        type: 'oauth_required',
        oauth: {
          authorization_endpoint: `${url}/api/oauth/authorize`,
          token_endpoint: `${url}/api/oauth/token`,
          client_id: 'mcp-client',
          response_type: 'code',
          scope: 'read write',
          redirect_uri: 'https://claude.ai/oauth/callback',
        },
      },
    },
  };
}