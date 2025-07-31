#!/usr/bin/env node

const http = require('http');

// Test configuration
const TOKEN = '3bc19baf-c02d-4db2-9c5a-f96b1e5c90a8';
const HOST = 'localhost';
const PORT = 3003;

// Test function
async function testMcpEndpoint(method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: Math.floor(Math.random() * 1000)
    });

    const options = {
      hostname: HOST,
      port: PORT,
      path: `/${TOKEN}/mcp`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    console.log(`\n=== Testing ${method} ===`);
    console.log('Request:', JSON.parse(requestData));

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        console.log('Response Headers:', res.headers);
        console.log('Response Body:', data);
        
        if (data) {
          try {
            const parsed = JSON.parse(data);
            console.log('Parsed Response:', JSON.stringify(parsed, null, 2));
            resolve(parsed);
          } catch (e) {
            console.log('Failed to parse response:', e.message);
            reject(e);
          }
        } else {
          console.log('❌ ERROR: Empty response body');
          reject(new Error('Empty response'));
        }
      });
    });

    req.on('error', (e) => {
      console.error('Request error:', e);
      reject(e);
    });

    req.write(requestData);
    req.end();
  });
}

// Run tests
async function runTests() {
  try {
    // Test 1: Initialize
    console.log('\n🧪 Test 1: Initialize');
    await testMcpEndpoint('initialize');
    
    // Test 2: Tools list
    console.log('\n🧪 Test 2: Tools List');
    await testMcpEndpoint('tools/list');
    
    // Test 3: Store memory
    console.log('\n🧪 Test 3: Store Memory');
    const storeResult = await testMcpEndpoint('tools/call', {
      name: 'storeMemory',
      arguments: {
        content: 'Test memory created at ' + new Date().toISOString(),
        metadata: {
          test: true,
          timestamp: new Date().toISOString()
        }
      }
    });
    
    // Check if memory ID was returned
    if (storeResult.result?.content?.[0]?.text) {
      const toolResult = JSON.parse(storeResult.result.content[0].text);
      if (toolResult.memoryId) {
        console.log('\n✅ SUCCESS: Memory ID received:', toolResult.memoryId);
      } else {
        console.log('\n❌ ERROR: No memory ID in response');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Explain the fix
console.log('=== MCP Communication Fix Test ===');
console.log('This tests the fixed MCP endpoint that returns responses in HTTP body');
console.log('instead of using SSE, which was causing Claude to hang.');
console.log('');

runTests();