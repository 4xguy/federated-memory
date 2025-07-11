# Claude Desktop Configuration (2025)

## ⚠️ Important: Remote MCP Server Changes in 2025

Claude Desktop now handles remote MCP servers differently:

### For Claude Pro/Max/Teams/Enterprise Users
- **DO NOT** configure remote servers in `claude_desktop_config.json`
- Go to **Claude Desktop → Settings → Integrations**
- Add the remote server there with:
  - URL: `https://federated-memory-production.up.railway.app/mcp`
  - Auth Type: Bearer Token
  - Token: Your API key

### For Free Claude Desktop Users
- Direct remote server configuration is **not supported**
- You must use a local proxy workaround (see below)

## Configuration File Locations

### macOS
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

### Windows
```
%APPDATA%\Claude\claude_desktop_config.json
```

### Linux
```
~/.config/claude/claude_desktop_config.json
```

## Free User Setup (Local Proxy Required)

### Option 1: Using mcp-remote (Recommended)

1. **Install mcp-remote globally:**
```bash
npm install -g @modelcontextprotocol/mcp-remote
```

2. **Create proxy configuration file** `federated-memory-proxy.json`:
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

3. **Configure Claude Desktop** in `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "federated-memory": {
      "command": "mcp-remote",
      "args": ["proxy", "/full/path/to/federated-memory-proxy.json"]
    }
  }
}
```

### Option 2: Custom Node.js Proxy

1. **Create** `federated-memory-proxy.js`:
```javascript
#!/usr/bin/env node
const https = require('https');

const API_KEY = process.env.FEDERATED_MEMORY_API_KEY || 'YOUR_API_KEY_HERE';

// Forward stdin to remote server
process.stdin.on('data', (data) => {
  const options = {
    hostname: 'federated-memory-production.up.railway.app',
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

  req.write(data);
  req.end();
});
```

2. **Make it executable:**
```bash
chmod +x federated-memory-proxy.js
```

3. **Configure Claude Desktop:**
```json
{
  "mcpServers": {
    "federated-memory": {
      "command": "node",
      "args": ["/full/path/to/federated-memory-proxy.js"],
      "env": {
        "FEDERATED_MEMORY_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

## Getting Your API Key

1. Sign in to: https://charming-mercy-production.up.railway.app
2. Navigate to "Manage API Keys"
3. Create a new API key
4. Copy the full key (shown only once!)
5. Replace `YOUR_API_KEY_HERE` in your configuration

## Testing the Configuration

1. **Save** your configuration file
2. **Completely quit** Claude Desktop (not just close the window)
3. **Restart** Claude Desktop
4. **Test** with commands like:
   - "Store this memory: I prefer TypeScript for backend development"
   - "Search my memories for programming"
   - "What memories do you have about my preferences?"

## Troubleshooting

### For Pro/Max Users
- Check Settings → Integrations for connection status
- Verify the server URL is correct
- Ensure your API key is valid

### For Free Users with Proxy
- Check proxy is running: `ps aux | grep mcp-remote`
- Verify proxy configuration file path is absolute
- Check Claude Desktop logs:
  - macOS: `~/Library/Logs/Claude/mcp*.log`
  - Windows: `%APPDATA%\Claude\logs\mcp*.log`

### Common Issues
- **"Server not responding"**: Verify backend is accessible at https://federated-memory-production.up.railway.app/api/health
- **"Authentication failed"**: Regenerate API key and update configuration
- **"No MCP tools available"**: Ensure you've restarted Claude Desktop completely

## Available MCP Tools

Once connected, you'll have access to:
- `searchMemories` - Search across all memory modules
- `storeMemory` - Store new memories with automatic categorization
- `getModuleStats` - View memory module statistics
- `listModules` - List available memory modules
- `getMemory` - Retrieve specific memory by ID

## Note on Security

- Never share your API key
- Store configuration files with appropriate permissions
- Consider using environment variables for API keys in shared systems