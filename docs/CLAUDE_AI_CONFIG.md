# Claude.ai (Web) MCP Configuration

## Important Note

As of July 2025, Claude.ai supports MCP servers through OAuth integration. This is a newer feature that requires proper OAuth setup.

## Configuration Steps

### 1. Ensure OAuth is Configured

Your OAuth providers (Google/GitHub) must be properly configured in your Railway frontend with these callback URLs:

**Google Console:**
- Authorized redirect URI: `https://your-frontend.railway.app/api/auth/callback/google`

**GitHub OAuth App:**
- Authorization callback URL: `https://your-frontend.railway.app/api/auth/callback/github`

### 2. Claude.ai MCP Configuration

In Claude.ai, you can add MCP servers through the settings. Look for "Integrations" or "MCP Servers" section.

**Configuration Format:**
```json
{
  "name": "Federated Memory",
  "description": "Intelligent memory management with federated modules",
  "server": {
    "url": "https://your-backend.railway.app/mcp",
    "transport": "http"
  },
  "auth": {
    "type": "oauth2",
    "authorization_url": "https://your-frontend.railway.app/api/auth/signin",
    "token_url": "https://your-backend.railway.app/api/auth/token",
    "client_id": "federated-memory-mcp",
    "scopes": ["memory:read", "memory:write", "memory:search"]
  }
}
```

### 3. Alternative: API Key Method

If OAuth integration isn't working, you can use API key authentication:

```json
{
  "name": "Federated Memory",
  "server": {
    "url": "https://your-backend.railway.app/mcp",
    "transport": "http"
  },
  "auth": {
    "type": "bearer",
    "token": "YOUR_API_KEY_FROM_FRONTEND"
  }
}
```

### 4. Environment Variables Needed

Ensure these are set in your Railway backend:

```bash
# OAuth Configuration
OAUTH_CLIENT_ID=federated-memory-mcp
OAUTH_CLIENT_SECRET=<secure-secret>
OAUTH_REDIRECT_BASE_URL=https://your-backend.railway.app

# JWT Configuration
JWT_SECRET=<secure-secret>
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d
```

## Testing Integration

1. **Add the MCP server** in Claude.ai settings
2. **Authorize the connection** through OAuth flow
3. **Test commands** in a conversation:
   ```
   Store this in my memory: I prefer TypeScript for backend development
   ```
   ```
   What programming languages do I prefer?
   ```
   ```
   Search my memories for work-related information
   ```

## Features Available

- **Memory Storage**: Store personal, work, technical, and creative memories
- **Intelligent Search**: Semantic search across all memory modules
- **Categorization**: Automatic routing to appropriate memory modules
- **Context Awareness**: Remembers context for better responses

## Troubleshooting

### OAuth Issues
- Verify callback URLs match exactly
- Check that frontend OAuth is working (test login flow)
- Ensure NEXTAUTH_URL is set correctly

### Connection Issues
- Test backend health endpoint: `https://your-backend.railway.app/api/health`
- Check Railway logs for errors
- Verify MCP endpoint: `https://your-backend.railway.app/mcp`

### Authentication Issues
- Generate fresh API key if using token auth
- Check JWT_SECRET is set in backend
- Verify OAuth client credentials

## Support

If you encounter issues:
1. Check Railway deployment logs
2. Test OAuth flow manually in frontend
3. Verify environment variables are set
4. Check Claude.ai integration documentation for updates