const axios = require('axios');

async function testAuthEndpoint() {
  try {
    console.log('Testing /api/auth/login endpoint...');
    
    const response = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'test@example.com',
      password: 'testpassword'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Success! Status:', response.status);
    console.log('Response:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('Error Status:', error.response.status);
      console.log('Error Data:', error.response.data);
      console.log('Error Headers:', error.response.headers);
    } else {
      console.log('Request Error:', error.message);
    }
  }
}

testAuthEndpoint();