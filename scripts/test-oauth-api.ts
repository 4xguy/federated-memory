import axios from 'axios';

async function testOAuthAPI() {
  const baseURL = 'http://localhost:3001/api';
  
  console.log('Testing OAuth API endpoints...\n');

  // Test token endpoint with invalid grant
  console.log('1. Testing token endpoint with invalid code...');
  try {
    const response = await axios.post(`${baseURL}/oauth/token`, {
      grant_type: 'authorization_code',
      code: 'invalid-code',
      client_id: 'claude-desktop',
      client_secret: 'development-secret',
      redirect_uri: 'claude-desktop://oauth/callback'
    });
    console.log('Unexpected success:', response.data);
  } catch (error: any) {
    console.log('✓ Expected error:', error.response?.data);
  }

  // Test with missing parameters
  console.log('\n2. Testing token endpoint with missing parameters...');
  try {
    const response = await axios.post(`${baseURL}/oauth/token`, {
      grant_type: 'authorization_code',
      client_id: 'claude-desktop'
    });
    console.log('Unexpected success:', response.data);
  } catch (error: any) {
    console.log('✓ Expected error:', error.response?.data);
  }

  // Test with invalid client
  console.log('\n3. Testing token endpoint with invalid client...');
  try {
    const response = await axios.post(`${baseURL}/oauth/token`, {
      grant_type: 'authorization_code',
      code: 'some-code',
      client_id: 'invalid-client',
      client_secret: 'wrong-secret',
      redirect_uri: 'http://localhost/callback'
    });
    console.log('Unexpected success:', response.data);
  } catch (error: any) {
    console.log('✓ Expected error:', error.response?.data);
  }

  // Test health endpoint
  console.log('\n4. Testing MCP health endpoint...');
  try {
    const response = await axios.get('http://localhost:3001/mcp/health');
    console.log('✓ MCP health:', response.data);
  } catch (error: any) {
    console.log('Error:', error.response?.data || error.message);
  }
}

testOAuthAPI();