const axios = require('axios');

async function testTokenFormat() {
  try {
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'test@example.com',
      password: 'TestPassword123!'
    });
    
    const token = loginResponse.data.token;
    console.log('Token received:', token);
    console.log('Token length:', token.length);
    console.log('Token format:', token.substring(0, 50) + '...');
    
    // Check if it's a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    console.log('Is UUID?:', uuidRegex.test(token));
    
    // Try to use the token
    console.log('\nTrying to access /api/users/me with token...');
    try {
      const meResponse = await axios.get('http://localhost:3000/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Success! User data:', meResponse.data);
    } catch (error) {
      console.log('Failed:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testTokenFormat();