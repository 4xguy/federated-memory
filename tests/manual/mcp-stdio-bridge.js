#!/usr/bin/env node

/**
 * MCP stdio-to-HTTP bridge for Claude Desktop
 * This bridges stdio transport (expected by Claude) to HTTP transport (used by our server)
 */

const readline = require('readline');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';
let sessionId = null;

// Set up stdio
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Log to stderr so it doesn't interfere with JSON-RPC
function log(...args) {
  console.error('[Bridge]', ...args);
}

// Send response to stdout
function sendResponse(response) {
  process.stdout.write(JSON.stringify(response) + '\n');
}

// Handle incoming JSON-RPC messages
async function handleMessage(message) {
  try {
    const request = JSON.parse(message);
    log('Received:', request.method || 'response');

    // Handle different message types
    if (request.method === 'initialize') {
      // Initialize session with HTTP server
      const httpResponse = await axios.post(MCP_SERVER_URL, request);
      sessionId = httpResponse.headers['mcp-session-id'];
      log('Session initialized:', sessionId);

      // Send response back through stdio
      sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: '1.0.0',
          serverInfo: {
            name: 'federated-memory',
            version: '1.0.0'
          },
          capabilities: {
            tools: {
              listChanged: false
            },
            prompts: {
              listChanged: false
            }
          }
        }
      });

      // Send initialized notification after a short delay
      setTimeout(async () => {
        try {
          await axios.post(MCP_SERVER_URL, {
            jsonrpc: '2.0',
            method: 'initialized',
            params: {}
          }, {
            headers: sessionId ? { 'Mcp-Session-Id': sessionId } : {}
          });
        } catch (err) {
          log('Failed to send initialized notification:', err.message);
        }
      }, 100);

    } else if (request.method === 'tools/list') {
      // Forward to HTTP server
      const httpResponse = await axios.post(MCP_SERVER_URL, request, {
        headers: sessionId ? { 'Mcp-Session-Id': sessionId } : {}
      });

      // Extract tools from response
      const tools = httpResponse.data?.result?.tools || [];
      
      sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema || {
              type: 'object',
              properties: {},
              required: []
            }
          }))
        }
      });

    } else if (request.method === 'tools/call') {
      // Forward to HTTP server
      const httpResponse = await axios.post(MCP_SERVER_URL, request, {
        headers: sessionId ? { 'Mcp-Session-Id': sessionId } : {}
      });

      sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        result: httpResponse.data?.result || { content: [] }
      });

    } else if (request.method === 'prompts/list') {
      // Forward to HTTP server
      const httpResponse = await axios.post(MCP_SERVER_URL, request, {
        headers: sessionId ? { 'Mcp-Session-Id': sessionId } : {}
      });

      sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        result: httpResponse.data?.result || { prompts: [] }
      });

    } else if (request.method === 'prompts/get') {
      // Forward to HTTP server
      const httpResponse = await axios.post(MCP_SERVER_URL, request, {
        headers: sessionId ? { 'Mcp-Session-Id': sessionId } : {}
      });

      sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        result: httpResponse.data?.result || { messages: [] }
      });

    } else if (request.method === 'notifications/message' || request.method === 'initialized') {
      // Handle notifications (no response needed)
      log('Notification:', request.method);
      
    } else {
      // Unknown method
      sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: 'Method not found',
          data: { method: request.method }
        }
      });
    }

  } catch (error) {
    log('Error handling message:', error.message);
    
    // Try to extract request ID for error response
    let requestId = null;
    try {
      const request = JSON.parse(message);
      requestId = request.id;
    } catch (e) {}

    if (requestId !== undefined) {
      sendResponse({
        jsonrpc: '2.0',
        id: requestId,
        error: {
          code: -32603,
          message: 'Internal error',
          data: { error: error.message }
        }
      });
    }
  }
}

// Read messages from stdin
rl.on('line', (line) => {
  if (line.trim()) {
    handleMessage(line);
  }
});

// Handle process termination
process.on('SIGINT', async () => {
  log('Shutting down bridge...');
  if (sessionId) {
    try {
      await axios.delete(MCP_SERVER_URL, {
        headers: { 'Mcp-Session-Id': sessionId }
      });
    } catch (err) {
      log('Failed to close session:', err.message);
    }
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log('Shutting down bridge...');
  if (sessionId) {
    try {
      await axios.delete(MCP_SERVER_URL, {
        headers: { 'Mcp-Session-Id': sessionId }
      });
    } catch (err) {
      log('Failed to close session:', err.message);
    }
  }
  process.exit(0);
});

// Check if server is available
async function checkServer() {
  try {
    await axios.get('http://localhost:3001/api/health');
    log('Connected to Federated Memory server at', MCP_SERVER_URL);
  } catch (error) {
    log('ERROR: Federated Memory server is not running!');
    log('Please start it with: npm run dev');
    process.exit(1);
  }
}

// Start the bridge
log('Starting MCP stdio-to-HTTP bridge...');
log('Server URL:', MCP_SERVER_URL);
checkServer();

// Keep the process alive
process.stdin.resume();