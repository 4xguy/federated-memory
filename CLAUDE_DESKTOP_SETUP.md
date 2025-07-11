# Claude Desktop Setup Guide for Federated Memory MCP Server

This guide will help you connect the Federated Memory MCP server to Claude Desktop using the latest configuration methods (as of July 2025).

## Prerequisites

1. Federated Memory server running on `http://localhost:3001`
2. Claude Desktop app installed
3. Node.js and npm installed

## Important Notes

- Claude Desktop supports both SSE and Streamable HTTP transports
- Remote servers should be configured via Settings > Integrations in Claude Desktop
- Local servers can use the `mcp-remote` adapter for Streamable HTTP support

## Setup Methods

### Method 1: Using mcp-remote Adapter (Recommended for Local Servers)

1. **Find your Claude Desktop config file:**
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/claude/claude_desktop_config.json`

2. **Edit the configuration file:**

```json
{
  "mcpServers": {
    "federated-memory": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:3001/mcp"
      ]
    }
  }
}
```

3. **Restart Claude Desktop** for the changes to take effect.

### Method 2: Direct Configuration (If Claude Desktop supports it)

If Claude Desktop has native Streamable HTTP support in your version:

```json
{
  "mcpServers": {
    "federated-memory": {
      "transport": {
        "type": "streamable-http",
        "url": "http://localhost:3001/mcp"
      }
    }
  }
}
```

### Method 3: Via Settings UI (For Remote Servers)

If you're hosting the server remotely:
1. Open Claude Desktop
2. Go to Settings > Integrations
3. Add a new MCP server
4. Enter the URL: `http://your-server-url:port/mcp`

## Testing the Connection

1. **Start your Federated Memory server:**
   ```bash
   npm run dev
   ```

2. **Restart Claude Desktop**

3. **In Claude Desktop, you should see:**
   - The server listed in available integrations
   - Ability to use memory commands

4. **Test commands in Claude:**
   - "Store this conversation in my memory"
   - "Search my memories for [topic]"
   - "What modules are available in my memory system?"

## Troubleshooting

### Server Not Appearing

1. **Check logs:**
   - macOS: `~/Library/Logs/Claude/`
   - Look for `mcp.log` and `mcp-server-federated-memory.log`

2. **Verify server is running:**
   ```bash
   curl http://localhost:3001/api/health
   ```

3. **Test MCP endpoint directly:**
   ```bash
   curl -X POST http://localhost:3001/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"1.0.0","clientInfo":{"name":"test","version":"1.0.0"},"capabilities":{"tools":true,"prompts":true}}}'
   ```

### Connection Errors

1. **Install mcp-remote globally if needed:**
   ```bash
   npm install -g mcp-remote
   ```

2. **Check if another service is using port 3001:**
   ```bash
   lsof -i :3001  # macOS/Linux
   netstat -ano | findstr :3001  # Windows
   ```

3. **Ensure CORS is properly configured** (already done in our server)

### Session Issues

If you see session-related errors:
1. The server manages sessions automatically
2. Sessions are created on first connection
3. Check server logs for session initialization

## Using the Integration

Once connected, you can use natural language to interact with your memory system:

### Examples:
- **Store memories**: "Remember that I learned about MCP protocol today"
- **Search**: "What do I know about Docker?"
- **Module-specific**: "Store this as a technical memory: [content]"
- **Stats**: "Show me statistics for my personal memories"

### Available Tools in Claude:
1. `searchMemories` - Search across all modules
2. `storeMemory` - Store new memories
3. `getMemory` - Retrieve specific memory by ID
4. `listModules` - See available memory modules
5. `getModuleStats` - Get statistics for a module

### Available Prompts:
1. `searchAndSummarize` - Search and get a summary of results

## Advanced Configuration

### Custom Environment Variables

```json
{
  "mcpServers": {
    "federated-memory": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3001/mcp"],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Multiple Instances

```json
{
  "mcpServers": {
    "federated-memory-dev": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3001/mcp"]
    },
    "federated-memory-prod": {
      "command": "npx",
      "args": ["mcp-remote", "http://production-server:3001/mcp"]
    }
  }
}
```

## Security Considerations

1. **Local Development**: The current setup is for localhost only
2. **Production**: Use HTTPS and proper authentication
3. **Permissions**: The server runs with your user permissions
4. **Data Privacy**: All memories are stored locally in your PostgreSQL database

## Next Steps

1. Test the connection with simple memory operations
2. Explore different memory modules
3. Build up your personal knowledge base
4. Consider adding custom modules for specific use cases

## Support

- Check server logs in terminal where `npm run dev` is running
- Review Claude Desktop logs for connection issues
- Test with the interactive script: `npm run test:mcp:interactive`