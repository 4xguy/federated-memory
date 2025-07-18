#!/bin/bash

echo "Testing MCP Server with direct connection..."
echo ""

# First, let's test listing available tools
echo "1. Listing available tools:"
npx @modelcontextprotocol/inspector --cli https://federated-memory-production.up.railway.app --method tools/list

echo ""
echo "2. Testing server initialization:"
npx @modelcontextprotocol/inspector --cli https://federated-memory-production.up.railway.app --method initialize --params '{}'

echo ""
echo "3. Testing a public tool (listModules):"
npx @modelcontextprotocol/inspector --cli https://federated-memory-production.up.railway.app --method tools/call --params '{"name": "listModules"}'