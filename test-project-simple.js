const axios = require('axios');

async function testProjectEndpoints() {
  try {
    // Login first
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'test@example.com',
      password: 'TestPassword123!'
    });
    
    const token = loginResponse.data.token;
    console.log('Token:', token);
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Test list projects
    console.log('\n--- Testing GET /api/projects/projects ---');
    try {
      const listResponse = await axios.get('http://localhost:3000/api/projects/projects', { headers });
      console.log('Status:', listResponse.status);
      console.log('Response:', JSON.stringify(listResponse.data, null, 2));
    } catch (error) {
      console.log('Error:', error.response?.data || error.message);
    }
    
    // Test create project
    console.log('\n--- Testing POST /api/projects/projects ---');
    try {
      const createResponse = await axios.post('http://localhost:3000/api/projects/projects', {
        name: 'Test Project',
        description: 'Test description'
      }, { headers });
      console.log('Status:', createResponse.status);
      console.log('Response:', JSON.stringify(createResponse.data, null, 2));
    } catch (error) {
      console.log('Error:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('Login error:', error.message);
  }
}

testProjectEndpoints();