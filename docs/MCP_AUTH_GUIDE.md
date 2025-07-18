# MCP Authentication Guide

This guide explains how to use the Federated Memory MCP server with Claude Desktop and other MCP-compatible clients.

## Quick Start

### 1. Get Your MCP URL

#### Option A: Using the Web Interface
1. Visit the registration page at `https://your-domain.com/register.html`
2. Click "Generate MCP URL without Email" for instant access
3. Copy the generated MCP URL (format: `https://your-domain.com/{token}/sse`)

#### Option B: Using the API
```bash
# Register and get a token
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{}' 

# Response:
# {
#   "success": true,
#   "data": {
#     "token": "550e8400-e29b-41d4-a716-446655440000",
#     "userId": "..."
#   }
# }
```

Your MCP URL will be: `https://your-domain.com/{token}/sse`

### 2. Configure Claude Desktop

Add the following to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "federated-memory": {
      "url": "https://your-domain.com/{YOUR-TOKEN}/sse",
      "transport": "sse"
    }
  }
}
```

### 3. Available Tools

Once connected, you'll have access to these tools:

- **searchMemory**: Search across your federated memory modules
- **storeMemory**: Store new information in memory
- **listModules**: List available memory modules
- **getModuleStats**: Get statistics about your stored memories

## Authentication Flow

The Federated Memory system uses a token-in-URL authentication pattern, similar to BigMemory:

1. **Token Generation**: A UUID token is generated when you register
2. **URL-based Auth**: The token is embedded in the MCP endpoint URL
3. **No Headers Required**: Authentication is handled entirely through the URL path
4. **SSE Communication**: Real-time updates via Server-Sent Events

## Security Considerations

- **Keep Your Token Safe**: Anyone with your token URL can access your memories
- **Token Rotation**: Use the API to rotate your token if needed:
  ```bash
  curl -X POST https://your-domain.com/api/auth/rotate \
    -H "Authorization: Bearer {YOUR-TOKEN}"
  ```
- **HTTPS Only**: Always use HTTPS URLs in production

## Example Usage in Claude Desktop

Once configured, you can use natural language to interact with your federated memory:

```
"Remember that the project deadline is March 15th"
"What do I have stored about project deadlines?"
"Show me my technical documentation memories"
```

## Troubleshooting

### Connection Issues
- Verify your token is correct
- Check that the URL uses HTTPS in production
- Ensure Claude Desktop has internet access

### No Response from Tools
- Check that the server is running
- Verify the token hasn't been rotated
- Look for errors in Claude Desktop's developer console

## API Reference

### Endpoints

- `GET /{token}/sse` - SSE endpoint for MCP communication
- `POST /{token}/messages/{sessionId}` - Message handling endpoint
- `GET /{token}` - Basic info endpoint

### Tool Schemas

#### searchMemory
```json
{
  "query": "string",
  "modules": ["array", "of", "module", "ids"],
  "limit": 10
}
```

#### storeMemory
```json
{
  "content": "string",
  "metadata": {
    "any": "additional",
    "context": "data"
  }
}
```

## Migration from OAuth

If you were using the OAuth-based authentication:

1. Generate a new token using the registration endpoint
2. Update your Claude Desktop configuration with the new URL format
3. Your existing memories remain accessible with the new token

## Support

For issues or questions:
- Check the [main documentation](../README.md)
- Review the [API documentation](./API.md)
- Submit issues on GitHub