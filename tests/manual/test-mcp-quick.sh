#\!/bin/bash

MCP_URL="http://localhost:3001/mcp"

echo "Testing MCP Store Function..."

# Initialize session
RESPONSE=$(curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {"protocolVersion": "0.1.0", "capabilities": {}},
    "id": 1
  }')

echo "Initialize response: $RESPONSE"
SESSION_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('sessionId', ''))")
echo "Session ID: $SESSION_ID"

# Store a test memory
echo -e "\nStoring test memory..."
curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "storeMemory",
      "arguments": {
        "content": "Test memory: Debug store function"
      }
    },
    "id": 2
  }' | python3 -m json.tool

# Search for it
echo -e "\nSearching for the stored memory..."
curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "searchMemories",
      "arguments": {
        "query": "Debug store function"
      }
    },
    "id": 3
  }' | python3 -m json.tool
