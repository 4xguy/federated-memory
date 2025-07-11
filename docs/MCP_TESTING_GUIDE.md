# MCP Testing Guide for Federated Memory System

This guide will help you test the Federated Memory MCP server using the MCP Inspector and other tools.

## Prerequisites

- Federated Memory server running on port 3001
- Node.js 18+ installed
- npx available (comes with npm)

## Method 1: Using MCP Inspector (Recommended)

The MCP Inspector is an interactive tool for testing MCP servers.

### Step 1: Start the Federated Memory Server

First, make sure your server is running:

```bash
npm run dev
```

You should see:
```
Federated Memory System running on port 3001
REST API: http://localhost:3001/api
MCP Streamable HTTP: http://localhost:3001/mcp
```

### Step 2: Create an Inspector Configuration

Create a file `mcp-inspector-config.json`:

```json
{
  "mcpServers": {
    "federated-memory": {
      "url": "http://localhost:3001/mcp",
      "transport": {
        "type": "stdio"
      }
    }
  }
}
```

### Step 3: Run the Inspector

Since our server uses HTTP transport, we'll create a simple wrapper script:

Create `inspector-wrapper.js`:

```javascript
#!/usr/bin/env node
const { spawn } = require('child_process');

// Start the inspector with HTTP endpoint
const args = process.argv.slice(2);
const inspector = spawn('npx', [
  '@modelcontextprotocol/inspector',
  'node',
  __dirname + '/scripts/mcp-client-wrapper.js',
  ...args
], {
  stdio: 'inherit',
  shell: true
});

inspector.on('error', (err) => {
  console.error('Failed to start inspector:', err);
});
```

Create `scripts/mcp-client-wrapper.js`:

```javascript
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const axios = require('axios');

// This wrapper converts stdio to HTTP requests
async function main() {
  const transport = new StdioClientTransport({
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
  });

  // Override send method to forward to HTTP
  const originalSend = transport.send.bind(transport);
  transport.send = async (message) => {
    try {
      const response = await axios.post('http://localhost:3001/mcp', message, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });
      
      // Forward response back through stdio
      if (response.data) {
        process.stdout.write(JSON.stringify(response.data) + '\n');
      }
    } catch (error) {
      console.error('HTTP request failed:', error.message);
    }
  };

  // Start the transport
  await transport.start();
}

main().catch(console.error);
```

### Step 4: Alternative - Direct HTTP Testing

For a simpler approach, create `test-inspector.sh`:

```bash
#!/bin/bash

# Test with curl directly
echo "Testing MCP Server at http://localhost:3001/mcp"

# Initialize session
SESSION_ID=$(curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "initialize",
    "params": {
      "protocolVersion": "1.0.0",
      "clientInfo": {
        "name": "mcp-inspector",
        "version": "1.0.0"
      },
      "capabilities": {
        "tools": true,
        "prompts": true
      }
    }
  }' | jq -r '.headers."mcp-session-id"' 2>/dev/null)

echo "Session ID: $SESSION_ID"

# List tools
echo -e "\n📋 Available Tools:"
curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": "2",
    "method": "tools/list",
    "params": {}
  }' | jq '.result.tools[]?.name' 2>/dev/null

# Test the inspector
npx @modelcontextprotocol/inspector
```

## Method 2: Using the Built-in Test Script

We've included a comprehensive test script:

```bash
npm run test:mcp
```

This will:
1. Initialize a session
2. List available tools
3. Test each tool with sample data
4. Show the results

## Method 3: Manual Testing with curl

### Initialize Session

```bash
# Initialize and save session ID
SESSION_ID=$(curl -s -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "initialize",
    "params": {
      "protocolVersion": "1.0.0",
      "clientInfo": {"name": "test", "version": "1.0.0"},
      "capabilities": {"tools": true, "prompts": true}
    }
  }' | jq -r '.headers."mcp-session-id"')

echo "Session: $SESSION_ID"
```

### List Tools

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": "2",
    "method": "tools/list",
    "params": {}
  }' | jq
```

### Call a Tool

```bash
# Search memories
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": "3",
    "method": "tools/call",
    "params": {
      "name": "searchMemories",
      "arguments": {
        "query": "test",
        "limit": 5
      }
    }
  }' | jq
```

### Store a Memory

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": "4",
    "method": "tools/call",
    "params": {
      "name": "storeMemory",
      "arguments": {
        "content": "Testing MCP server with inspector",
        "metadata": {
          "tags": ["test", "mcp", "inspector"]
        }
      }
    }
  }' | jq
```

## Method 4: Using Python Client

Create `test_mcp.py`:

```python
#!/usr/bin/env python3
import requests
import json
import sys

class MCPClient:
    def __init__(self, base_url):
        self.base_url = base_url
        self.session_id = None
        
    def initialize(self):
        response = requests.post(
            self.base_url,
            json={
                "jsonrpc": "2.0",
                "id": "1",
                "method": "initialize",
                "params": {
                    "protocolVersion": "1.0.0",
                    "clientInfo": {"name": "python-test", "version": "1.0.0"},
                    "capabilities": {"tools": True, "prompts": True}
                }
            }
        )
        self.session_id = response.headers.get('Mcp-Session-Id')
        return response.json()
    
    def call_tool(self, tool_name, arguments):
        return requests.post(
            self.base_url,
            headers={"Mcp-Session-Id": self.session_id},
            json={
                "jsonrpc": "2.0",
                "id": "2",
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments
                }
            }
        ).json()

# Test the client
client = MCPClient("http://localhost:3001/mcp")
print("Initializing...", client.initialize())
print("\nSearching memories...", client.call_tool("searchMemories", {"query": "test"}))
```

## Method 5: Integration with Claude Desktop

Add to your Claude Desktop configuration:

### macOS
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "federated-memory": {
      "url": "http://localhost:3001/mcp",
      "transport": {
        "type": "http",
        "config": {
          "endpoint": "http://localhost:3001/mcp"
        }
      }
    }
  }
}
```

### Windows
Edit `%APPDATA%\Claude\claude_desktop_config.json`

### Linux
Edit `~/.config/claude/claude_desktop_config.json`

## Troubleshooting

### Connection Issues
- Ensure server is running on port 3001
- Check firewall settings
- Verify no other service is using the port

### Session Errors
- Sessions expire after inactivity
- Re-initialize if you get session errors
- Check server logs for detailed errors

### Tool Errors
- Verify required parameters are provided
- Check data types match schema
- Look at server logs for stack traces

## Expected Results

When everything is working correctly:

1. **Initialize**: Returns server capabilities
2. **List Tools**: Shows 5 tools (searchMemories, storeMemory, etc.)
3. **Search**: Returns matching memories with similarity scores
4. **Store**: Returns the new memory ID
5. **Module Stats**: Shows memory counts and usage

## Next Steps

1. Try different search queries
2. Store memories with various metadata
3. Test module-specific searches
4. Monitor performance with many memories
5. Test concurrent operations