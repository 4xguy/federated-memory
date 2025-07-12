# Claude.ai Web Integration Guide

This guide explains how to connect Claude.ai web version to your Federated Memory MCP server.

## Overview

The Federated Memory System now supports OAuth 2.0 authentication with PKCE (Proof Key for Code Exchange), enabling secure connections from Claude.ai web interface to your MCP server.

## Key Features Added

### 1. OAuth 2.0 with PKCE Support
- Authorization code flow with PKCE for secure authentication
- Support for public clients (no client secret required with PKCE)
- Automatic token refresh support

### 2. OAuth Discovery Endpoints
- `/.well-known/oauth-authorization-server` - OAuth server metadata
- `/.well-known/oauth-protected-resource` - Resource server metadata
- Compliant with RFC 8414 for automatic discovery

### 3. CORS Configuration
- Configured to accept requests from `https://claude.ai` and subdomains
- Supports credentials for secure cookie handling
- Proper preflight request handling

### 4. Streamable HTTP Transport (SSE)
- Server-Sent Events for real-time bidirectional communication
- Session management for persistent connections
- `/sse/info` endpoint for MCP server metadata

## Setup Instructions

### 1. Environment Configuration

Update your `.env` file with the following:

```bash
# Production base URL (required for OAuth)
BASE_URL=https://your-domain.railway.app

# Claude.ai OAuth client secret
CLAUDE_AI_CLIENT_SECRET=generate-a-secure-secret-here

# Frontend URL for OAuth consent screen
FRONTEND_URL=https://your-frontend-domain.com
```

### 2. Deploy to Railway

1. Push your changes to GitHub
2. Railway will automatically deploy the updated server
3. Ensure your custom domain is configured in Railway
4. Verify the OAuth discovery endpoints are accessible:
   - `https://your-domain.railway.app/.well-known/oauth-authorization-server`
   - `https://your-domain.railway.app/.well-known/oauth-protected-resource`

### 3. Configure Claude.ai

When adding your MCP server in Claude.ai:

1. **Server URL**: `https://your-domain.railway.app/sse`
2. **Authentication Type**: OAuth 2.0
3. **Client ID**: `claude-ai` or `mcp-client`
4. **Authorization Flow**: Authorization Code with PKCE
5. **Scopes**: `read write profile`

Alternatively, Claude.ai may auto-discover your server using:
- Discovery endpoint: `https://your-domain.railway.app/sse/info`
- OAuth metadata: `https://your-domain.railway.app/.well-known/oauth-authorization-server`

The OAuth flow will be handled automatically by Claude.ai.

## OAuth Flow

1. Claude.ai initiates OAuth flow with PKCE challenge
2. User is redirected to your authorization endpoint
3. User logs in via Google/GitHub (if not already authenticated)
4. User approves access for Claude.ai
5. Authorization code is returned to Claude.ai
6. Claude.ai exchanges code for access token (with PKCE verifier)
7. MCP connection is established using the access token

## Security Considerations

1. **PKCE Protection**: Prevents authorization code interception attacks
2. **Secure Token Storage**: Refresh tokens are hashed with SHA-256
3. **CORS Restrictions**: Only allowed origins can access the API
4. **Session Isolation**: Each MCP session has its own transport instance
5. **Token Expiration**: Access tokens expire after 1 hour, refresh tokens after 30 days

## API Endpoints

### OAuth Endpoints
- `GET /api/oauth/authorize` - Authorization endpoint
- `POST /api/oauth/token` - Token exchange endpoint
- `POST /api/oauth/revoke` - Token revocation endpoint

### MCP Endpoints
- `POST /mcp` - Main MCP communication endpoint
- `GET /mcp` - SSE endpoint for server-initiated messages
- `GET /sse/info` - MCP server metadata
- `GET /mcp/health` - Health check endpoint

## Troubleshooting

### "Not allowed by CORS" Error
- Ensure your `BASE_URL` in production matches your actual domain
- Check that Claude.ai is using HTTPS

### OAuth Flow Fails
- Verify the `CLAUDE_AI_CLIENT_SECRET` matches in both environments
- Check that the redirect URI from Claude.ai matches the configured URIs
- Ensure the user has an active session (logged in via Google/GitHub)

### Connection Drops
- Check Railway logs for session management issues
- Verify the SSE connection is not being terminated by proxies
- Ensure proper error handling in your memory modules

## Future Enhancements

### Dynamic Client Registration (DCR)
The foundation for DCR is in place but not yet implemented. This would allow:
- Automatic client registration without pre-shared secrets
- Per-instance client credentials
- Enhanced security through client rotation

To implement DCR, create the `/api/oauth/register` endpoint that generates new client credentials dynamically.

## Support

For issues or questions:
1. Check the server logs in Railway dashboard
2. Verify the OAuth discovery endpoints are accessible
3. Test the OAuth flow manually using curl or Postman
4. Open an issue in the GitHub repository

## Related Documentation

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [OAuth 2.0 RFC](https://datatracker.ietf.org/doc/html/rfc6749)
- [PKCE RFC](https://datatracker.ietf.org/doc/html/rfc7636)
- [Railway Deployment Guide](https://docs.railway.app/)