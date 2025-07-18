const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const API_URL = 'http://localhost:3000/api';

// Test utilities
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

class AuthTestSuite {
  constructor() {
    this.testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Test User'
    };
    this.token = null;
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async runTest(name, testFn) {
    this.results.total++;
    log(`\nTest: ${name}`, 'info');
    try {
      await testFn();
      this.results.passed++;
      log('✓ PASSED', 'success');
      return true;
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({ test: name, error: error.message });
      log(`✗ FAILED: ${error.message}`, 'error');
      if (error.response?.data) {
        console.log('Response:', error.response.data);
      }
      return false;
    }
  }

  async runAllTests() {
    log('\n=== Authentication Test Suite ===\n', 'info');
    
    // Run tests in sequence
    await this.runTest('Register new user', () => this.testRegister());
    await this.runTest('Login with valid credentials', () => this.testLogin());
    await this.runTest('Access protected endpoint', () => this.testProtectedEndpoint());
    await this.runTest('Invalid login attempt', () => this.testInvalidLogin());
    await this.runTest('Token validation', () => this.testTokenValidation());
    await this.runTest('Token rotation', () => this.testTokenRotation());
    await this.runTest('User profile update', () => this.testUserProfile());
    await this.runTest('Concurrent requests', () => this.testConcurrentRequests());
    await this.runTest('Rate limiting', () => this.testRateLimiting());
    await this.runTest('Session management', () => this.testSessionManagement());
    
    this.printResults();
  }

  async testRegister() {
    const response = await axios.post(`${API_URL}/auth/register-email`, this.testUser);
    if (!response.data.success && !response.data.emailVerificationRequired) {
      throw new Error('Registration did not return expected response');
    }
  }

  async testLogin() {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: this.testUser.email,
      password: this.testUser.password
    });
    
    if (!response.data.token) {
      throw new Error('Login did not return token');
    }
    
    this.token = response.data.token;
    
    // Validate token format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(this.token)) {
      throw new Error('Token is not valid UUID format');
    }
  }

  async testProtectedEndpoint() {
    const response = await axios.get(`${API_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    
    if (!response.data.id || !response.data.email) {
      throw new Error('User data incomplete');
    }
    
    if (response.data.email !== this.testUser.email) {
      throw new Error('Email mismatch');
    }
  }

  async testInvalidLogin() {
    try {
      await axios.post(`${API_URL}/auth/login`, {
        email: this.testUser.email,
        password: 'WrongPassword!'
      });
      throw new Error('Invalid login should have failed');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error('Invalid login should return 401');
      }
    }
  }

  async testTokenValidation() {
    // Test with invalid token
    try {
      await axios.get(`${API_URL}/users/me`, {
        headers: { 'Authorization': 'Bearer invalid-token' }
      });
      throw new Error('Invalid token should have failed');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error('Invalid token should return 401');
      }
    }

    // Test with no token
    try {
      await axios.get(`${API_URL}/users/me`);
      throw new Error('No token should have failed');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error('No token should return 401');
      }
    }
  }

  async testTokenRotation() {
    const response = await axios.post(`${API_URL}/auth/rotate`, {
      currentToken: this.token
    }, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    
    if (!response.data.token) {
      throw new Error('Token rotation did not return new token');
    }
    
    const newToken = response.data.token;
    
    // Test old token is invalid
    try {
      await axios.get(`${API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      throw new Error('Old token should be invalid');
    } catch (error) {
      if (error.response?.status !== 401) {
        throw new Error('Old token should return 401');
      }
    }
    
    // Update token for future tests
    this.token = newToken;
  }

  async testUserProfile() {
    // Get profile
    const getResponse = await axios.get(`${API_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    
    if (!getResponse.data.id) {
      throw new Error('User profile missing ID');
    }
    
    // Test stats endpoint
    const statsResponse = await axios.get(`${API_URL}/users/stats`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    
    if (typeof statsResponse.data.totalMemories !== 'number') {
      throw new Error('Stats response invalid');
    }
  }

  async testConcurrentRequests() {
    // Send 5 concurrent requests
    const promises = Array(5).fill().map(() => 
      axios.get(`${API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      })
    );
    
    const results = await Promise.all(promises);
    
    // All should succeed
    for (const result of results) {
      if (result.status !== 200) {
        throw new Error('Concurrent request failed');
      }
    }
  }

  async testRateLimiting() {
    // This test is informational - rate limiting might not be implemented
    const promises = Array(20).fill().map(() => 
      axios.post(`${API_URL}/auth/login`, {
        email: 'ratelimit@test.com',
        password: 'password'
      }).catch(e => e.response)
    );
    
    const results = await Promise.all(promises);
    const rateLimited = results.filter(r => r?.status === 429);
    
    if (rateLimited.length > 0) {
      log(`Rate limiting active: ${rateLimited.length}/20 requests limited`, 'warning');
    } else {
      log('No rate limiting detected', 'warning');
    }
  }

  async testSessionManagement() {
    // Test that token persists across requests
    const response1 = await axios.get(`${API_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const response2 = await axios.get(`${API_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    
    if (response1.data.id !== response2.data.id) {
      throw new Error('Session not consistent');
    }
  }

  printResults() {
    log('\n=== Test Results ===', 'info');
    log(`Total tests: ${this.results.total}`, 'info');
    log(`Passed: ${this.results.passed}`, 'success');
    log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'error' : 'success');
    
    if (this.results.errors.length > 0) {
      log('\nFailed tests:', 'error');
      this.results.errors.forEach(({ test, error }) => {
        log(`  - ${test}: ${error}`, 'error');
      });
    }
    
    const percentage = Math.round((this.results.passed / this.results.total) * 100);
    log(`\nSuccess rate: ${percentage}%`, percentage === 100 ? 'success' : 'warning');
  }
}

// Run the test suite
async function main() {
  const suite = new AuthTestSuite();
  await suite.runAllTests();
}

main().catch(console.error);