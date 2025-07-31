#!/usr/bin/env node

const http = require('http');

// Test configuration
const TOKEN = 'f74651c1-f24e-437e-b591-51a7922b69f2';
const HOST = 'localhost';
const PORT = 3003;

// Test function
async function testMcpEndpoint(method, params = {}, sessionId = null) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: Math.floor(Math.random() * 1000)
    });

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestData),
      'Accept': 'application/json, text/event-stream'
    };
    
    if (sessionId) {
      headers['mcp-session-id'] = sessionId;
    }

    const options = {
      hostname: HOST,
      port: PORT,
      path: `/${TOKEN}/mcp`,
      method: 'POST',
      headers: headers
    };

    console.log(`\n=== Testing ${method} ===`);
    console.log('Request:', JSON.parse(requestData));
    if (sessionId) {
      console.log('Session ID:', sessionId);
    }

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        console.log('Response Headers:', res.headers);
        
        // Check for session ID in headers
        const newSessionId = res.headers['mcp-session-id'];
        if (newSessionId) {
          console.log('New Session ID:', newSessionId);
        }
        
        console.log('Response Body:', data);
        
        if (data) {
          try {
            // Handle SSE format
            if (data.startsWith('event:')) {
              const lines = data.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('data: ')) {
                  const jsonData = lines[i].substring(6);
                  const parsed = JSON.parse(jsonData);
                  console.log('Parsed Response:', JSON.stringify(parsed, null, 2));
                  resolve({ response: parsed, sessionId: newSessionId || sessionId });
                  return;
                }
              }
            } else {
              // Regular JSON response
              const parsed = JSON.parse(data);
              console.log('Parsed Response:', JSON.stringify(parsed, null, 2));
              resolve({ response: parsed, sessionId: newSessionId || sessionId });
            }
          } catch (e) {
            console.log('Failed to parse response:', e.message);
            reject(e);
          }
        } else {
          console.log('✅ Empty response (expected for Streamable HTTP)');
          resolve({ response: null, sessionId: newSessionId || sessionId });
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
    const { response: initResponse, sessionId } = await testMcpEndpoint('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {},
        sampling: {}
      },
      clientInfo: {
        name: 'test-streamable-mcp',
        version: '1.0.0'
      }
    });
    
    if (!sessionId) {
      console.log('❌ ERROR: No session ID returned from initialize');
      return;
    }
    
    console.log('✅ Session initialized:', sessionId);
    
    // Test 2: Tools list (with session)
    console.log('\n🧪 Test 2: Tools List');
    const { response: toolsResponse } = await testMcpEndpoint('tools/list', {}, sessionId);
    
    // Test 3: Store memory
    console.log('\n🧪 Test 3: Store Memory');
    const { response: storeResponse } = await testMcpEndpoint('tools/call', {
      name: 'storeMemory',
      arguments: {
        content: 'Test memory created at ' + new Date().toISOString(),
        metadata: {
          test: true,
          timestamp: new Date().toISOString()
        }
      }
    }, sessionId);
    
    // Check if memory ID was returned
    if (storeResponse?.result?.content?.[0]?.text) {
      const toolResult = JSON.parse(storeResponse.result.content[0].text);
      if (toolResult.memoryId) {
        console.log('\n✅ SUCCESS: Memory ID received:', toolResult.memoryId);
      } else {
        console.log('\n❌ ERROR: No memory ID in response');
      }
    }
    
    // Test 4: Health check
    console.log('\n🧪 Test 4: Health Check');
    const healthReq = http.request({
      hostname: HOST,
      port: PORT,
      path: `/${TOKEN}/mcp/health`,
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('Health Status:', res.statusCode);
        console.log('Health Response:', data);
      });
    });
    healthReq.end();
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Explain the test
console.log('=== Streamable HTTP MCP Test ===');
console.log('Testing the new Streamable HTTP implementation with proper session management');
console.log('Server:', `http://${HOST}:${PORT}`);
console.log('');

runTests();