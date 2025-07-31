#!/usr/bin/env node

const http = require('http');

// Test configuration
const TOKEN = '3bc19baf-c02d-4db2-9c5a-f96b1e5c90a8';
const HOST = 'localhost';
const PORT = 3003;

// Create the MCP request
const requestData = JSON.stringify({
  jsonrpc: '2.0',
  method: 'tools/call',
  params: {
    name: 'storeMemory',
    arguments: {
      content: 'Test memory created at ' + new Date().toISOString(),
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    }
  },
  id: 1
});

// Request options
const options = {
  hostname: HOST,
  port: PORT,
  path: `/${TOKEN}/mcp`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestData)
  },
  rejectUnauthorized: false // For localhost testing
};

console.log('Sending storeMemory request to MCP endpoint...');
console.log('URL:', `http://${HOST}:${PORT}/${TOKEN}/mcp`);
console.log('Request:', JSON.parse(requestData));

// Make the request
const req = http.request(options, (res) => {
  console.log('\nResponse Status:', res.statusCode);
  console.log('Response Headers:', res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse Body:', data);
    
    if (data) {
      try {
        const parsed = JSON.parse(data);
        console.log('\nParsed Response:', JSON.stringify(parsed, null, 2));
        
        if (parsed.result?.content?.[0]?.text) {
          const toolResult = JSON.parse(parsed.result.content[0].text);
          console.log('\nTool Result:', JSON.stringify(toolResult, null, 2));
          
          if (toolResult.memoryId) {
            console.log('\n✅ SUCCESS: Memory ID received:', toolResult.memoryId);
          } else {
            console.log('\n❌ ERROR: No memory ID in response');
          }
        }
      } catch (e) {
        console.log('\nFailed to parse response:', e.message);
      }
    } else {
      console.log('\n❌ ERROR: Empty response body - this is the issue!');
      console.log('The MCP endpoint is returning empty responses and sending data via SSE instead.');
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

// Send the request
req.write(requestData);
req.end();