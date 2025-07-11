# Claude Desktop MCP Configuration Guide

## Prerequisites

1. Federated Memory backend deployed and running
2. Valid API key generated from the frontend dashboard
3. Claude Desktop installed on your system

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

## Configuration Format

Since Federated Memory is a remote HTTP MCP server (not a local command), you'll need to use a proxy approach. Create a local proxy script first:

### Step 1: Create a Local Proxy Script

Create a file called `federated-memory-proxy.js` in a convenient location (e.g., `~/mcp-servers/`):

```javascript
const { Client } = require('@modelcontextprotocol/sdk');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/transport/stdio');

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['-e', `
      const http = require('http');
      const { Transform } = require('stream');
      
      process.stdin.pipe(new Transform({
        transform(chunk, encoding, callback) {
          const request = http.request({
            hostname: 'federated-memory-production.up.railway.app',
            path: '/mcp',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${process.env.FEDERATED_MEMORY_API_KEY}'
            }
          }, (res) => {
            res.on('data', (data) => {
              process.stdout.write(data);
            });
          });
          
          request.write(chunk);
          request.end();
          callback();
        }
      }));
    `]
  });

  const client = new Client();
  await client.connect(transport);
}

main().catch(console.error);
```

### Step 2: Configure Claude Desktop

Edit your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "federated-memory": {
      "command": "node",
      "args": ["/path/to/federated-memory-proxy.js"],
      "env": {
        "FEDERATED_MEMORY_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

### Alternative: Using npx with a Remote HTTP Server Package

If a community package exists for HTTP MCP servers, you could use:

```json
{
  "mcpServers": {
    "federated-memory": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-http-proxy",
        "--url", "https://federated-memory-production.up.railway.app/mcp",
        "--auth", "Bearer YOUR_API_KEY_HERE"
      ]
    }
  }
}
```

**Note**: The `@modelcontextprotocol/server-http-proxy` package may not exist yet. Check npm for available HTTP proxy packages for MCP.

## Replace YOUR_API_KEY_HERE

1. Log into the frontend: https://charming-mercy-production.up.railway.app
2. Go to "Manage API Keys"
3. Create a new API key
4. Copy the full key (it starts with something like `sk_live_`)
5. Replace `YOUR_API_KEY_HERE` in the config with your actual key

## Testing the Connection

1. Save the configuration file
2. Restart Claude Desktop completely (Quit and reopen)
3. Start a new conversation
4. Test with commands like:
   - "Store this memory: I prefer TypeScript for backend development"
   - "What do you remember about my programming preferences?"
   - "Search my memories for TypeScript"

## Troubleshooting

### "Server not available" error
- Verify the backend URL is accessible: https://federated-memory-production.up.railway.app/api/health
- Check your API key is valid
- Ensure you've restarted Claude Desktop after configuration

### Authentication errors
- Verify your API key was copied correctly
- Check that the key hasn't been deleted in the dashboard
- Try generating a new API key

### No response from MCP commands
- Check Claude Desktop logs (Help → Show Logs)
- Verify the MCP server is listed in Claude's available tools
- Try the alternative configuration format

## Available MCP Tools

Once connected, you'll have access to these tools:

1. **searchMemories** - Search across all memory modules
2. **storeMemory** - Store new memories with automatic categorization
3. **getModuleStats** - View statistics for memory modules
4. **listModules** - List all available memory modules
5. **getMemory** - Retrieve a specific memory by ID

## Example Usage

```
Human: Store this memory: I'm working on a React project with TypeScript and Tailwind CSS