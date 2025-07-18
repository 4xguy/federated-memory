const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'TestPassword123!';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, type = 'info') {
  const color = type === 'success' ? colors.green : 
                type === 'error' ? colors.red : 
                type === 'warning' ? colors.yellow : colors.blue;
  console.log(`${color}${message}${colors.reset}`);
}

async function testAuthFlow() {
  log('\n=== Testing Authentication Flow ===\n', 'info');
  
  let token = null;
  let verificationToken = null;

  // Test 1: Register a new user
  log('1. Testing user registration...', 'info');
  try {
    const registerResponse = await axios.post(`${API_URL}/auth/register-email`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    log('✓ Registration successful', 'success');
    console.log('Response:', registerResponse.data);
    
    if (registerResponse.data.emailVerificationRequired) {
      log('  Email verification required', 'warning');
      verificationToken = registerResponse.data.verificationToken; // In production, this would be sent via email
    }
  } catch (error) {
    if (error.response?.status === 409) {
      log('  User already exists, continuing with login test', 'warning');
    } else {
      log(`✗ Registration failed: ${error.response?.data?.error || error.message}`, 'error');
      return;
    }
  }

  // Test 2: Try to login before email verification
  log('\n2. Testing login before email verification...', 'info');
  try {
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    if (loginResponse.data.token) {
      log('✓ Login successful (email already verified)', 'success');
      token = loginResponse.data.token;
      console.log('Token:', token.substring(0, 20) + '...');
    }
  } catch (error) {
    if (error.response?.status === 403) {
      log('✓ Correctly prevented login - email not verified', 'success');
    } else {
      log(`✗ Login test failed: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  // Test 3: Verify email (if we have a verification token)
  if (verificationToken) {
    log('\n3. Testing email verification...', 'info');
    try {
      const verifyResponse = await axios.get(`${API_URL}/auth/verify-email?token=${verificationToken}`);
      log('✓ Email verification successful', 'success');
      console.log('Response:', verifyResponse.data);
    } catch (error) {
      log(`✗ Email verification failed: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  // Test 4: Login after verification
  if (!token) {
    log('\n4. Testing login after email verification...', 'info');
    try {
      const loginResponse = await axios.post(`${API_URL}/auth/login`, {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });
      
      log('✓ Login successful', 'success');
      token = loginResponse.data.token;
      console.log('Token:', token.substring(0, 20) + '...');
    } catch (error) {
      log(`✗ Login failed: ${error.response?.data?.error || error.message}`, 'error');
      return;
    }
  }

  // Test 5: Access protected endpoint
  log('\n5. Testing protected endpoint access...', 'info');
  try {
    const protectedResponse = await axios.get(`${API_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    log('✓ Protected endpoint access successful', 'success');
    console.log('User data:', protectedResponse.data);
  } catch (error) {
    log(`✗ Protected endpoint access failed: ${error.response?.data?.error || error.message}`, 'error');
  }

  // Test 6: Invalid password
  log('\n6. Testing login with invalid password...', 'info');
  try {
    await axios.post(`${API_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: 'WrongPassword123!'
    });
    log('✗ Should have failed with invalid password', 'error');
  } catch (error) {
    if (error.response?.status === 401) {
      log('✓ Correctly rejected invalid password', 'success');
    } else {
      log(`✗ Unexpected error: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  // Test 7: Token rotation
  log('\n7. Testing token rotation...', 'info');
  try {
    const rotateResponse = await axios.post(`${API_URL}/auth/rotate`, {
      currentToken: token
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    log('✓ Token rotation successful', 'success');
    const newToken = rotateResponse.data.token;
    console.log('New token:', newToken.substring(0, 20) + '...');
    
    // Verify old token is invalid
    try {
      await axios.get(`${API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      log('✗ Old token should be invalid', 'error');
    } catch (error) {
      if (error.response?.status === 401) {
        log('✓ Old token correctly invalidated', 'success');
      }
    }
  } catch (error) {
    log(`✗ Token rotation failed: ${error.response?.data?.error || error.message}`, 'error');
  }

  log('\n=== Authentication Flow Testing Complete ===\n', 'info');
}

// Run the tests
testAuthFlow().catch(console.error);