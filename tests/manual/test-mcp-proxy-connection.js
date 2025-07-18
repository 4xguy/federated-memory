const fetch = require('node-fetch');

async function testProxyToServerConnection() {
  const PROXY_URL = 'http://localhost:6274';
  const SERVER_URL = 'https://federated-memory-production.up.railway.app';
  
  console.log('Testing MCP Inspector Proxy -> Server Connection\n');
  
  // First, test direct server access
  console.log('1. Direct server health check:');
  try {
    const directResponse = await fetch(`${SERVER_URL}/health`);
    console.log(`Direct to server: ${directResponse.status} ${directResponse.statusText}`);
    
    const configResponse = await fetch(`${SERVER_URL}/config`);
    const config = await configResponse.json();
    console.log('Server config retrieved:', JSON.stringify(config.mcp.transport, null, 2));
  } catch (error) {
    console.error('Direct server error:', error.message);
  }
  
  // Test if we need to use the proxy's API to connect to the server
  console.log('\n2. Testing proxy connection methods:');
  
  // Try to understand the proxy's API
  const proxyEndpoints = [
    { path: '/api/servers', method: 'GET' },
    { path: '/api/connect', method: 'POST' },
    { path: '/api/health', method: 'GET' }
  ];
  
  for (const endpoint of proxyEndpoints) {
    try {
      const response = await fetch(`${PROXY_URL}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      console.log(`${endpoint.method} ${endpoint.path}: ${response.status}`);
      if (response.status === 200) {
        const text = await response.text();
        if (text && text.startsWith('{')) {
          console.log('Response:', JSON.parse(text));
        }
      }
    } catch (error) {
      console.log(`${endpoint.method} ${endpoint.path}: ${error.message}`);
    }
  }
  
  // Test MCP-specific endpoints
  console.log('\n3. Testing MCP endpoints on production server:');
  let mcpEndpoint = `${SERVER_URL}/mcp`;
  
  try {
    // Test OPTIONS preflight
    const optionsResponse = await fetch(mcpEndpoint, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:6274',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Mcp-Session-Id'
      }
    });
    console.log(`OPTIONS ${mcpEndpoint}: ${optionsResponse.status}`);
    console.log('CORS Headers:', {
      'Access-Control-Allow-Origin': optionsResponse.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': optionsResponse.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': optionsResponse.headers.get('Access-Control-Allow-Headers')
    });
  } catch (error) {
    console.error('OPTIONS request error:', error.message);
  }
}

testProxyToServerConnection();