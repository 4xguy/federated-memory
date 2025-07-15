const fetch = require('node-fetch');

async function testMCPInspectorProxyHealth() {
  console.log('Testing MCP Inspector Proxy Health Check...\n');
  
  // Test the local MCP Inspector proxy health
  try {
    console.log('1. Testing localhost:6274 (MCP Inspector Proxy)...');
    const proxyResponse = await fetch('http://localhost:6274/health', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('Proxy Response Status:', proxyResponse.status);
    const proxyData = await proxyResponse.text();
    console.log('Proxy Response:', proxyData);
  } catch (error) {
    console.error('Error checking proxy health:', error.message);
  }
  
  // Test various potential health endpoints on the proxy
  const endpoints = [
    'http://localhost:6274/',
    'http://localhost:6274/api/health',
    'http://localhost:6274/proxy/health',
    'http://localhost:6274/mcp-proxy/health'
  ];
  
  console.log('\n2. Testing various proxy endpoints...');
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      console.log(`${endpoint}: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.log(`${endpoint}: ${error.message}`);
    }
  }
}

testMCPInspectorProxyHealth();