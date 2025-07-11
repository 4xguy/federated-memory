# MCP Server Documentation

The Federated Memory System provides a Model Context Protocol (MCP) server with Streamable HTTP transport, allowing LLMs like Claude.ai to interact with the memory system through a standardized protocol.

## 🚀 Claude.ai Web Integration

The MCP server now supports OAuth 2.0 authentication with PKCE, enabling secure connections from Claude.ai web interface. See [Claude.ai Integration Guide](./CLAUDE_AI_INTEGRATION.md) for detailed setup instructions.

## Current Status

### Working Features ✅
1. **Server is running** on `http://localhost:3001/mcp`
2. **Health endpoint** works: `http://localhost:3001/mcp/health`
3. **Tools are registered** correctly in the MCP server
4. **Memory operations work** - memories are successfully stored and retrieved
5. **Module routing works** - content is intelligently routed to appropriate modules

### Known Issues ⚠️
1. **Error Messages on Success**: The `storeMemory` function returns error messages even when memories are successfully stored
2. **Module Stats Parameter**: The `getModuleStats` function parameter validation has minor issues
3. **Direct HTTP Testing**: Session initialization with direct curl commands requires specific headers

## Overview

The MCP server exposes the memory system's functionality as tools and prompts that can be accessed by MCP-compatible clients. It supports:

- **Tools**: Functions for storing, searching, and retrieving memories
- **Prompts**: Pre-configured templates for common memory operations
- **Session Management**: Stateful connections with session persistence
- **Streamable HTTP**: Support for both request-response and server-sent events

## Endpoints

### Local Development
```
http://localhost:3000/mcp
```

### Production (for Claude.ai)
```
https://your-domain.railway.app/sse
```

### OAuth Discovery
```
https://your-domain.railway.app/.well-known/oauth-authorization-server
https://your-domain.railway.app/.well-known/oauth-protected-resource
```

### MCP Server Info
```
https://your-domain.railway.app/sse/info
```

## Available Tools

### 1. searchMemories
Search across all memory modules using semantic search.

**Parameters:**
- `query` (string, required): Search query
- `limit` (number, optional): Maximum results (default: 10)
- `moduleId` (string, optional): Specific module to search

**Example:**
```json
{
  "query": "docker configuration",
  "limit": 5,
  "moduleId": "technical"
}
```

### 2. storeMemory
Store a new memory in the appropriate module.

**Parameters:**
- `content` (string, required): Memory content
- `metadata` (object, optional): Memory metadata
- `moduleId` (string, optional): Target module (auto-routed if not specified)

**Example:**
```json
{
  "content": "Learned about MCP protocol implementation",
  "metadata": {
    "tags": ["mcp", "protocol", "learning"],
    "source": "documentation"
  }
}
```

**Note**: Currently returns error message even on successful storage. Check with search to verify.

### 3. getMemory
Retrieve a specific memory by ID.

**Parameters:**
- `memoryId` (string, required): Memory ID

### 4. listModules
Get list of all available memory modules.

**Parameters:** None

**Returns:** 6 modules: technical, personal, work, learning, communication, creative

### 5. getModuleStats
Get statistics for a specific module.

**Parameters:**
- `moduleId` (string, required): Module ID (supports autocomplete)

**Note**: Ensure parameter is `moduleId` with lowercase 'i', not 'l'.

## Available Prompts

### searchAndSummarize
Search memories and provide a summary.

**Arguments:**
- `topic` (string, required): Topic to search for
- `maxResults` (number, optional): Maximum results (default: 5)

## Client Configuration

### For Claude Desktop

Add to your `claude_desktop_config.json`:

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

**Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

### For Custom Clients

1. Send an initialize request to establish a session
2. Include the returned `Mcp-Session-Id` header in all subsequent requests
3. Use JSON-RPC 2.0 format for all messages
4. Include `Accept: application/json, text/event-stream` header

## Protocol Details

### Initialize Request
```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "method": "initialize",
  "params": {
    "protocolVersion": "0.1.0",
    "capabilities": {
      "tools": {"call": true},
      "prompts": {"get": true}
    }
  }
}
```

### Tool Call Request
```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "method": "tools/call",
  "params": {
    "name": "searchMemories",
    "arguments": {
      "query": "your search query",
      "limit": 10
    }
  }
}
```

### Session Management

- Sessions are created on initialize and tracked via `Mcp-Session-Id` header
- Sessions persist across multiple requests
- Close sessions with DELETE request to `/mcp`
- Session ID is returned in the response headers after initialization

## Security

- DNS rebinding protection enabled
- Allowed hosts: 127.0.0.1, localhost, localhost:3001, localhost:3000
- CORS configured for Claude.ai and local development
- Optional authentication via Authorization header (JWT tokens supported)

## Testing

### Quick Test
```bash
# Test health endpoint
curl http://localhost:3001/mcp/health

# Expected response:
# {"status":"ok","protocol":"streamable-http","sessions":0,"capabilities":{...}}
```

### Full Test Suite
Run the included test script:
```bash
npm run test:mcp
```

Or use the manual test script:
```bash
chmod +x docs/test-mcp.sh
./docs/test-mcp.sh
```

## Integration Examples

### Python Client
```python
import requests
import json

# Initialize session with proper headers
init_request = {
    "jsonrpc": "2.0",
    "id": "1",
    "method": "initialize",
    "params": {
        "protocolVersion": "0.1.0",
        "capabilities": {"tools": {"call": True}}
    }
}

headers = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
}

response = requests.post("http://localhost:3001/mcp", json=init_request, headers=headers)
session_id = response.headers.get("Mcp-Session-Id")

# Call a tool
tool_request = {
    "jsonrpc": "2.0",
    "id": "2",
    "method": "tools/call",
    "params": {
        "name": "searchMemories",
        "arguments": {"query": "python tips", "limit": 5}
    }
}

headers["Mcp-Session-Id"] = session_id
result = requests.post("http://localhost:3001/mcp", json=tool_request, headers=headers)
print(result.json())
```

### Using with LangChain
```python
from langchain.tools import Tool
from langchain.agents import initialize_agent

# Create MCP tool wrapper
def search_memories(query: str) -> str:
    # MCP client code here
    pass

memory_search_tool = Tool(
    name="FederatedMemorySearch",
    func=search_memories,
    description="Search the federated memory system"
)

# Use with an agent
agent = initialize_agent(
    tools=[memory_search_tool],
    llm=your_llm,
    agent="zero-shot-react-description"
)
```

## Troubleshooting

### "Failed to store memory" but memory is actually stored
This is a known issue with error handling. The memory is successfully stored despite the error message. Verify with search.

### "Invalid arguments for tool getModuleStats"
Ensure you're passing `moduleId` (with lowercase 'i') as the parameter name.

### "Not Acceptable: Client must accept both application/json and text/event-stream"
Include the header: `Accept: application/json, text/event-stream`

### "Bad Request: Server not initialized"
The streamable HTTP transport requires specific initialization. Use Claude Desktop or mcp-remote for best results.

### Session Not Found
The session may have expired. Send a new initialize request without a session ID.

### Tool Not Found
List available tools with:
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/list",
  "params": {}
}
```

## Next Steps

1. Fix error response handling in storeMemory function
2. Implement actual statistics calculation for modules
3. Add proper success responses with memory IDs
4. Add WebSocket support for real-time updates
5. Implement user authentication for multi-tenant scenarios