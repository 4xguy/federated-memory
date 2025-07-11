# Claude Desktop Remote MCP Configuration (2025)

## Important: Remote MCP Server Support in 2025

As of 2025, Claude Desktop supports remote MCP servers, but with specific requirements:

### For Claude Pro/Max/Teams/Enterprise Users

**You cannot configure remote MCP servers via `claude_desktop_config.json`**. Instead:

1. Open Claude Desktop
2. Go to **Settings → Integrations**
3. Add your remote MCP server there
4. Enter:
   - Server URL: `https://federated-memory-production.up.railway.app/mcp`
   - Authentication: Bearer token
   - API Key: Your generated API key

### For Free Claude Desktop Users

You'll need to use a local proxy workaround. Here's how:

## Option 1: Using MCP-Remote Proxy (Recommended)

### Step 1: Install mcp-remote

```bash
npm install -g @modelcontextprotocol/mcp-remote
```

### Step 2: Create a proxy configuration

Create `federated-memory-proxy.json`:

```json
{
  "name": "federated-memory",
  "url": "https://federated-memory-production.up.railway.app/mcp",
  "transport": "http",
  "headers": {
    "Authorization": "Bearer YOUR_API_KEY_HERE"
  }
}
```

### Step 3: Run the proxy

```bash
mcp-remote proxy federated-memory-proxy.json
```

This will output a local server URL (e.g., `http://localhost:3000`)

### Step 4: Configure Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "federated-memory": {
      "command": "mcp-remote",
      "args": ["proxy", "/path/to/federated-memory-proxy.json"]
    }
  }
}
```

## Option 2: Custom Node.js Proxy

Create `federated-memory-local-proxy.js`:

```javascript
#!/usr/bin/env node
const { spawn } = require('child_process');
const https = require('https');

// Configuration
const REMOTE_HOST = 'federated-memory-production.up.railway.app';
const API_KEY = process.env.FEDERATED_MEMORY_API_KEY || 'YOUR_API_KEY_HERE';

// Create a local stdio transport that forwards to remote HTTP
process.stdin.on('data', async (data) => {
  const options = {
    hostname: REMOTE_HOST,
    path: '/mcp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Length': data.length
    }
  };

  const req = https.request(options, (res) => {
    res.on('data', (chunk) => {
      process.stdout.write(chunk);
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.write(data);
  req.end();
});

// Handle SSE for server-sent events
const sseReq = https.get({
  hostname: REMOTE_HOST,
  path: '/mcp',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Accept': 'text/event-stream'
  }
}, (res) => {
  res.on('data', (chunk) => {
    process.stdout.write(chunk);
  });
});
```

Then configure Claude Desktop:

```json
{
  "mcpServers": {
    "federated-memory": {
      "command": "node",
      "args": ["/path/to/federated-memory-local-proxy.js"],
      "env": {
        "FEDERATED_MEMORY_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

## Verification

1. Restart Claude Desktop after configuration
2. Check if the MCP server appears in available tools
3. Test with: "Store this memory: I prefer TypeScript for backend development"

## Troubleshooting

- **Pro/Max Users**: Check Settings → Integrations for connection status
- **Free Users**: Check proxy logs for connection errors
- **All Users**: Verify API key is valid and backend is accessible

## Notes

- Remote MCP support is officially in beta as of 2025
- Direct HTTP/SSE transport in `claude_desktop_config.json` is not supported
- OAuth-based authentication requires Dynamic Client Registration (not needed for API key auth)
- The proxy workaround is necessary for free tier users until official support is added