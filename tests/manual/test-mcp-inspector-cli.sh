#!/bin/bash

echo "Testing MCP connection to production server using MCP Inspector CLI mode..."
echo ""
echo "This will connect directly without the browser UI CORS issues."
echo ""

# Test the connection using CLI mode
echo "Running MCP Inspector in CLI mode with your production server:"
echo ""

npx @modelcontextprotocol/inspector --cli https://federated-memory-production.up.railway.app

# Alternative: If you want to test with specific transport
# npx @modelcontextprotocol/inspector --cli --transport sse https://federated-memory-production.up.railway.app