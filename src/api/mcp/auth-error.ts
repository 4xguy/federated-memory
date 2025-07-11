export class AuthenticationRequiredError extends Error {
  public code: number;
  public data: any;

  constructor(authUrl: string) {
    super('Authentication required');
    this.name = 'AuthenticationRequiredError';
    this.code = -32001; // Custom error code for auth required
    this.data = {
      type: 'oauth_required',
      auth_url: authUrl,
      message: 'Please authenticate to access this resource',
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