# Authentication Guide

This system uses different authentication methods for different clients:

## 1. Token-Based Authentication (MCP/Claude.ai ONLY)

**Endpoint Pattern:** `https://fmbe.clauvin.com/{token}/mcp`

- Direct token authentication via URL
- NO OAuth required or supported for MCP
- Token is a UUID that must be pre-registered in the database
- This is the ONLY way to authenticate with MCP endpoints

### Usage:
```
https://fmbe.clauvin.com/f74651c1-f24e-437e-b591-51a7922b69f2/mcp
```

### Important:
- MCP endpoints do NOT support OAuth
- Always use the token-based endpoint pattern
- The `/mcp` endpoint without a token will NOT work
- OAuth discovery endpoints return 404 for MCP clients

## 2. OAuth Authentication (Web Frontend ONLY)

**Endpoint:** `https://fmbe.clauvin.com/api/auth/{provider}`

- Social login via Google/GitHub  
- For web frontend access only
- NOT used for MCP/Claude.ai
- Redirects to frontend with auth token

### Flow:
1. User clicks "Login with Google/GitHub"
2. Redirected to: `https://fmbe.clauvin.com/api/auth/google`
3. After OAuth: redirected to `https://fm.clauvin.com/auth/success?token=...`
4. Frontend stores token and uses it for API calls

## Configuration for Claude.ai

**CORRECT Configuration:**
```json
{
  "mcpServers": {
    "federated-memory": {
      "url": "https://fmbe.clauvin.com/YOUR-TOKEN-HERE/mcp"
    }
  }
}
```

**INCORRECT Configuration:**
```json
{
  "mcpServers": {
    "federated-memory": {
      "url": "https://fmbe.clauvin.com/mcp"  // ❌ This requires OAuth!
    }
  }
}
```

## Troubleshooting

### "OAuth Required" Error in Claude.ai
- You're using `/mcp` instead of `/{token}/mcp`
- Make sure your URL includes your UUID token

### Frontend OAuth Redirect Issues
- Ensure `FRONTEND_URL` is set in Railway environment variables
- Should be set to your frontend URL (e.g., `https://fm.clauvin.com`)

### Token Not Working
- Verify token exists in database
- Check token format (should be valid UUID)
- Ensure no trailing slashes or spaces