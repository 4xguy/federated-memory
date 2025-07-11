# Claude Desktop Configuration

## Configuration File Location

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

## Configuration for Federated Memory MCP Server

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "federated-memory": {
      "command": "node",
      "args": ["-e", "require('http').request('https://your-backend.railway.app/mcp', {method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer YOUR_API_KEY'}}).end()"],
      "transport": {
        "type": "http"
      },
      "url": "https://your-backend.railway.app/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json"
      }
    }
  }
}
```

## Alternative: Direct HTTP Configuration

If you prefer a simpler HTTP-only setup:

```json
{
  "mcpServers": {
    "federated-memory": {
      "transport": {
        "type": "http",
        "url": "https://your-backend.railway.app/mcp"
      },
      "auth": {
        "type": "bearer",
        "token": "YOUR_API_KEY"
      }
    }
  }
}
```

## Getting Your API Key

1. Sign in to your frontend: `https://your-frontend.railway.app`
2. Go to the "API Keys" section
3. Generate a new API key
4. Copy the key and replace `YOUR_API_KEY` in the config

## Testing the Configuration

1. Save the configuration file
2. Restart Claude Desktop
3. Open a new conversation
4. Try using memory-related commands like:
   - "Store this information: My favorite programming language is TypeScript"
   - "Search my memories for programming"
   - "What do you remember about my preferences?"

## Troubleshooting

- Check Claude Desktop logs for connection errors
- Verify your Railway backend URL is accessible
- Ensure your API key is valid and has proper permissions
- Check that the MCP server is running on Railway