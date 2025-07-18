#!/usr/bin/env node

// Test MCP discovery patterns to understand what Claude.ai expects

const https = require('https');
const http = require('http');

async function testEndpoint(url, description) {
  console.log(`\n=== Testing: ${description} ===`);
  console.log(`URL: ${url}`);
  
  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === 'https:';
  const lib = isHttps ? https : http;
  
  return new Promise((resolve) => {
    const req = lib.get(url, (res) => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('Response:', JSON.stringify(json, null, 2));
        } catch (e) {
          console.log('Response (raw):', data);
        }
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log(`Error: ${err.message}`);
      resolve();
    });
    
    req.setTimeout(5000, () => {
      console.log('Request timed out');
      req.destroy();
      resolve();
    });
  });
}

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.log('Usage: node test-mcp-discovery.js <token>');
    process.exit(1);
  }
  
  const baseUrl = process.env.BASE_URL || 'https://federated-memory-production.up.railway.app';
  
  console.log('Testing MCP discovery endpoints...');
  console.log('Base URL:', baseUrl);
  console.log('Token:', token.substring(0, 8) + '...');
  
  // Test various endpoint patterns
  await testEndpoint(`${baseUrl}/${token}`, 'Token root endpoint');
  await testEndpoint(`${baseUrl}/${token}/config`, 'Token config endpoint');
  await testEndpoint(`${baseUrl}/${token}/.well-known/oauth-authorization-server`, 'Token OAuth discovery');
  await testEndpoint(`${baseUrl}/config`, 'Global config endpoint');
  await testEndpoint(`${baseUrl}/.well-known/oauth-authorization-server`, 'Global OAuth discovery');
  
  // Test SSE endpoint with headers
  console.log('\n=== Testing SSE Endpoint ===');
  const sseUrl = `${baseUrl}/${token}/sse`;
  console.log(`URL: ${sseUrl}`);
  
  const sseUrlObj = new URL(sseUrl);
  const sseLib = sseUrlObj.protocol === 'https:' ? https : http;
  
  const sseReq = sseLib.get({
    hostname: sseUrlObj.hostname,
    port: sseUrlObj.port,
    path: sseUrlObj.pathname,
    headers: {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
    }
  }, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);
    
    if (res.statusCode === 200) {
      console.log('SSE connection established successfully');
      
      res.on('data', (chunk) => {
        const data = chunk.toString();
        if (data.trim() && data !== ':') {
          console.log('SSE data:', data);
        }
      });
      
      setTimeout(() => {
        console.log('Closing SSE connection after 3 seconds');
        res.destroy();
      }, 3000);
    }
  });
  
  sseReq.on('error', (err) => {
    console.log(`SSE Error: ${err.message}`);
  });
}

main().catch(console.error);