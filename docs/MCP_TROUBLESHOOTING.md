# MCP Connection Troubleshooting Guide

## Error: "WebSocket error" in Claude.ai

If you're seeing WebSocket connection errors when adding the MCP server to Claude.ai, follow these steps:

### 1. Verify Server is Running

First, ensure your federated-memory server is properly deployed and accessible:

```bash
# Check if server is running locally
curl http://localhost:3000/api/health

# Check MCP endpoint
curl http://localhost:3000/mcp/health
```

### 2. Check Railway Deployment

If deployed on Railway:
- Verify the deployment is active
- Check the deployment logs for errors
- Ensure environment variables are set correctly
- Get your public URL from Railway dashboard

### 3. Configure Claude Desktop

In Claude Desktop settings (Developer → Edit Config), use the correct configuration:

```json
{
  "mcpServers": {
    "federated-memory": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/inspector",
        "wss://YOUR-RAILWAY-URL/mcp"
      ]
    }
  }
}
```

Replace `YOUR-RAILWAY-URL` with your actual Railway deployment URL (e.g., `federated-memory-production.up.railway.app`).

### 4. Test with MCP Inspector First

Before adding to Claude.ai, test with MCP Inspector:

```bash
# Test local server
npx @modelcontextprotocol/inspector
# Enter URL: http://localhost:3000/mcp

# Test deployed server
npx @modelcontextprotocol/inspector
# Enter URL: https://YOUR-RAILWAY-URL/mcp
```

### 5. Common Issues and Solutions

#### Issue: Connection Timeout
- **Cause**: Server not accessible or CORS blocking
- **Solution**: 
  - Ensure server is running and accessible
  - Check CORS configuration includes Claude.ai origins
  - Verify no firewall blocking connections

#### Issue: WebSocket Connection Failed
- **Cause**: WSS protocol issues or proxy configuration
- **Solution**:
  - Use HTTPS URL for production deployments
  - Ensure WebSocket support is enabled on hosting platform
  - Check if reverse proxy supports WebSocket upgrades

#### Issue: OAuth Not Triggering
- **Cause**: Connection fails before authentication check
- **Solution**:
  - Fix connection issues first
  - Verify OAuth endpoints are accessible
  - Check BASE_URL environment variable is set correctly

### 6. OAuth Configuration

Ensure these endpoints are accessible:
- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource`
- `/api/oauth/authorize`
- `/api/oauth/token`

Test OAuth discovery:
```bash
curl https://YOUR-RAILWAY-URL/.well-known/oauth-protected-resource
```

### 7. Debug Mode

Enable debug logging to see detailed connection info:

1. Set environment variable:
   ```
   LOG_LEVEL=debug
   ```

2. Check server logs for:
   - MCP session initialization
   - OAuth error responses
   - WebSocket upgrade attempts

### 8. Alternative Connection Methods

If WebSocket continues to fail, try:

1. **Use mcp-client-proxy**:
   ```json
   {
     "mcpServers": {
       "federated-memory": {
         "command": "npx",
         "args": [
           "-y",
           "mcp-client-proxy",
           "--transport",
           "stdio",
           "https://YOUR-RAILWAY-URL/mcp"
         ]
       }
     }
   }
   ```

2. **Use SSE endpoint** (if WebSocket fails):
   - Change `/mcp` to `/sse` in the URL
   - Note: SSE is legacy but more compatible

### 9. Verify Authentication Flow

Once connected, the OAuth flow should:
1. Return 401 with WWW-Authenticate header when calling protected tools
2. Claude.ai should show OAuth login prompt
3. After authentication, tools become available

### 10. Contact Support

If issues persist:
1. Check Railway deployment logs
2. Verify all environment variables are set
3. Test with a simple HTTP client first
4. Report issue with:
   - Error messages from console
   - Network tab screenshots
   - Server logs