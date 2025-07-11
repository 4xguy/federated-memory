# MCP Setup Guide for Claude Desktop

This guide will help you set up the Federated Memory MCP server to work with Claude Desktop.

## Prerequisites

- Federated Memory server running (default: http://localhost:3001)
- Claude Desktop installed
- `mcp-remote` package installed globally: `npm install -g mcp-remote`

## Setup Steps

### 1. Start the Federated Memory Server

```bash
# In the federated-memory directory
npm run dev
```

Verify the server is running:
```bash
curl http://localhost:3001/mcp/health
# Should return: {"status":"ok","protocol":"streamable-http",...}
```

### 2. Configure Claude Desktop

Add the following configuration to your Claude Desktop MCP servers:

**Option A: Use the provided config file**
```bash
# Copy the example config (adjust path as needed)
cp claude-desktop-config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Option B: Manual configuration**

Edit your Claude Desktop config file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Add this configuration:
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

### 3. Restart Claude Desktop

After updating the configuration, restart Claude Desktop for changes to take effect.

## Available MCP Tools

Once connected, you'll have access to these tools in Claude Desktop:

### 1. **listModules**
Get a list of all available memory modules.
```
No parameters required
```

### 2. **storeMemory**
Store a new memory in the system.
```
Parameters:
- content (required): The memory content to store
- metadata (optional): Additional metadata as key-value pairs
- moduleId (optional): Target module (auto-routed if not specified)
```

### 3. **searchMemories**
Search across all memory modules.
```
Parameters:
- query (required): Search query
- limit (optional): Maximum results (default: 10)
- moduleId (optional): Specific module to search
```

### 4. **getMemory**
Retrieve a specific memory by ID.
```
Parameters:
- memoryId (required): The ID of the memory to retrieve
```

### 5. **getModuleStats**
Get statistics for a specific module.
```
Parameters:
- moduleId (required): The module to get stats for
```

## Troubleshooting

### Server Connection Issues

1. **Check server is running**:
   ```bash
   curl http://localhost:3001/mcp/health
   ```

2. **Check MCP endpoint**:
   ```bash
   curl -X POST http://localhost:3001/mcp \
     -H "Content-Type: application/json" \
     -d '{"method":"initialize","params":{"protocolVersion":"0.1.0","capabilities":{}}}'
   ```

3. **Check logs**:
   - Server logs: Check terminal where `npm run dev` is running
   - Claude Desktop logs: Enable developer tools in Claude Desktop

### Common Issues

1. **"Cannot read properties of undefined" errors**
   - Ensure the server is fully started before connecting
   - Check that all modules loaded successfully in server logs

2. **Tools not appearing in Claude Desktop**
   - Verify the config file is in the correct location
   - Ensure JSON syntax is valid
   - Restart Claude Desktop after config changes

3. **Connection refused**
   - Check if port 3001 is available
   - Try changing port: `PORT=3002 npm run dev`
   - Update the MCP URL in config accordingly

### Testing the Connection

You can test the MCP server directly:

```bash
# Initialize session
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "0.1.0",
      "capabilities": {}
    },
    "id": 1
  }'

# List available tools (use session ID from initialize response)
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 2
  }'
```

## Security Considerations

- The MCP server uses anonymous access by default
- To enable user authentication, pass JWT tokens in requests
- Configure CORS settings in production environments
- Use HTTPS in production deployments

## Next Steps

1. Try storing a memory: "Store this technical note: PostgreSQL pgvector enables semantic search"
2. Search for memories: "Search for PostgreSQL information"
3. List available modules to see the full system structure
4. Explore module-specific features for different memory types