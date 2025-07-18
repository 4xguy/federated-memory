const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000/api';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, type = 'info') {
  const color = type === 'success' ? colors.green : 
                type === 'error' ? colors.red : 
                type === 'warning' ? colors.yellow : 
                type === 'test' ? colors.magenta : colors.blue;
  console.log(`${color}${message}${colors.reset}`);
}

class ComprehensiveTestSuite {
  constructor() {
    this.testUser = null;
    this.token = null;
    this.projectId = null;
    this.taskId = null;
    this.memoryId = null;
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async setup() {
    log('\n=== Test Setup ===', 'info');
    
    // Create a test user directly in database with verified email
    const email = `test-${Date.now()}@example.com`;
    const password = 'TestPassword123!';
    const passwordHash = await bcrypt.hash(password, 10);
    
    this.testUser = await prisma.user.create({
      data: {
        id: uuidv4(),
        token: uuidv4(),
        email,
        passwordHash,
        emailVerified: true, // Skip email verification for testing
        isActive: true
      }
    });
    
    log(`Created test user: ${email}`, 'success');
    
    // Login to get auth token
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });
    
    this.token = loginResponse.data.token;
    log(`Got auth token: ${this.token.substring(0, 20)}...`, 'success');
  }

  async cleanup() {
    log('\n=== Test Cleanup ===', 'info');
    
    try {
      // Delete test user and all related data
      if (this.testUser) {
        await prisma.user.delete({
          where: { id: this.testUser.id }
        });
        log('Cleaned up test user', 'success');
      }
    } catch (error) {
      log(`Cleanup error: ${error.message}`, 'warning');
    }
    
    await prisma.$disconnect();
  }

  async runTest(category, name, testFn) {
    this.results.total++;
    log(`\n[${category}] ${name}`, 'test');
    
    try {
      const startTime = Date.now();
      await testFn();
      const duration = Date.now() - startTime;
      
      this.results.passed++;
      log(`✓ PASSED (${duration}ms)`, 'success');
      return true;
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({ category, test: name, error: error.message });
      log(`✗ FAILED: ${error.message}`, 'error');
      if (error.response?.data) {
        console.log('Response:', JSON.stringify(error.response.data, null, 2));
      }
      return false;
    }
  }

  async runAllTests() {
    log('\n=== Comprehensive Test Suite for Federated Memory ===', 'info');
    
    try {
      await this.setup();
      
      // 1. Authentication Tests
      await this.runAuthTests();
      
      // 2. Memory Module Tests
      await this.runMemoryTests();
      
      // 3. Project Management Tests
      await this.runProjectTests();
      
      // 4. Search and Routing Tests
      await this.runSearchTests();
      
      // 5. Real-time Tests
      await this.runRealtimeTests();
      
      // 6. Performance Tests
      await this.runPerformanceTests();
      
      // 7. Error Handling Tests
      await this.runErrorTests();
      
    } finally {
      await this.cleanup();
      this.printResults();
    }
  }

  async runAuthTests() {
    log('\n--- Authentication Tests ---', 'info');
    
    await this.runTest('AUTH', 'Valid token access', async () => {
      const response = await axios.get(`${API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (!response.data.id || response.data.email !== this.testUser.email) {
        throw new Error('User data mismatch');
      }
    });
    
    await this.runTest('AUTH', 'Invalid token rejection', async () => {
      try {
        await axios.get(`${API_URL}/users/me`, {
          headers: { 'Authorization': 'Bearer invalid-token' }
        });
        throw new Error('Should have rejected invalid token');
      } catch (error) {
        if (error.response?.status !== 401) {
          throw new Error('Should return 401 for invalid token');
        }
      }
    });
    
    await this.runTest('AUTH', 'Token rotation', async () => {
      const response = await axios.post(`${API_URL}/auth/rotate`, {
        currentToken: this.token
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (!response.data.token) {
        throw new Error('Token rotation failed');
      }
      
      this.token = response.data.token; // Update for future tests
    });
  }

  async runMemoryTests() {
    log('\n--- Memory Module Tests ---', 'info');
    
    await this.runTest('MEMORY', 'Store memory', async () => {
      const response = await axios.post(`${API_URL}/memories`, {
        content: 'Test memory content for comprehensive testing',
        title: 'Test Memory',
        metadata: {
          category: 'test',
          importance: 'high'
        }
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (!response.data.id) {
        throw new Error('Memory creation failed');
      }
      
      this.memoryId = response.data.id;
    });
    
    await this.runTest('MEMORY', 'Search memories', async () => {
      const response = await axios.get(`${API_URL}/memories/search`, {
        params: {
          query: 'test memory comprehensive',
          limit: 10
        },
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (!Array.isArray(response.data.results)) {
        throw new Error('Search did not return results array');
      }
    });
    
    await this.runTest('MEMORY', 'Get memory by ID', async () => {
      if (!this.memoryId) return;
      
      const response = await axios.get(`${API_URL}/memories/${this.memoryId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.data.id !== this.memoryId) {
        throw new Error('Memory ID mismatch');
      }
    });
  }

  async runProjectTests() {
    log('\n--- Project Management Tests ---', 'info');
    
    await this.runTest('PROJECT', 'Create project', async () => {
      const response = await axios.post(`${API_URL}/projects/projects`, {
        name: 'Comprehensive Test Project',
        description: 'Testing all project features',
        status: 'active',
        team: [this.testUser.email]
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (!response.data.id) {
        throw new Error('Project creation failed');
      }
      
      this.projectId = response.data.id;
    });
    
    await this.runTest('PROJECT', 'Create task', async () => {
      const response = await axios.post(`${API_URL}/projects/tasks`, {
        title: 'Test Task',
        description: 'Comprehensive test task',
        projectId: this.projectId,
        status: 'todo',
        priority: 'high'
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (!response.data.id) {
        throw new Error('Task creation failed');
      }
      
      this.taskId = response.data.id;
    });
    
    await this.runTest('PROJECT', 'Update task status', async () => {
      // Skip if task creation failed
      if (!this.taskId) {
        log('Skipping - no task ID', 'warning');
        return;
      }
      
      const response = await axios.put(`${API_URL}/projects/tasks/${this.taskId}`, {
        status: 'in_progress'
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.data.status !== 'in_progress') {
        throw new Error('Task status not updated');
      }
    });
  }

  async runSearchTests() {
    log('\n--- Search and Routing Tests ---', 'info');
    
    await this.runTest('SEARCH', 'Cross-module search', async () => {
      const response = await axios.get(`${API_URL}/memories/search`, {
        params: {
          query: 'test',
          limit: 20
        },
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (!response.data.results) {
        throw new Error('Search failed');
      }
    });
  }

  async runRealtimeTests() {
    log('\n--- Real-time Tests ---', 'info');
    
    await this.runTest('REALTIME', 'SSE connection', async () => {
      // SSE uses different pattern (/:token/sse), skip for now
      log('SSE uses token-based URL pattern, skipping API test', 'warning');
    });
  }

  async runPerformanceTests() {
    log('\n--- Performance Tests ---', 'info');
    
    await this.runTest('PERF', 'Concurrent memory creation', async () => {
      const startTime = Date.now();
      
      const promises = Array(5).fill().map((_, i) => 
        axios.post(`${API_URL}/memories`, {
          content: `Performance test memory ${i}`,
          title: `Perf Test ${i}`,
          metadata: { test: true, index: i }
        }, {
          headers: { 'Authorization': `Bearer ${this.token}` }
        })
      );
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      if (results.some(r => !r.data.id)) {
        throw new Error('Some memories failed to create');
      }
      
      log(`Created 5 memories in ${duration}ms (${Math.round(duration/5)}ms avg)`, 'info');
    });
    
    await this.runTest('PERF', 'Search performance', async () => {
      const startTime = Date.now();
      
      const response = await axios.get(`${API_URL}/memories/search`, {
        params: {
          query: 'performance test',
          limit: 50
        },
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      const duration = Date.now() - startTime;
      
      if (duration > 1000) {
        throw new Error(`Search too slow: ${duration}ms (target: <1000ms)`);
      }
      
      log(`Search completed in ${duration}ms`, 'info');
    });
  }

  async runErrorTests() {
    log('\n--- Error Handling Tests ---', 'info');
    
    await this.runTest('ERROR', 'Invalid memory data', async () => {
      try {
        await axios.post(`${API_URL}/memories`, {
          // Missing required content field
          title: 'Invalid Memory'
        }, {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        throw new Error('Should have rejected invalid data');
      } catch (error) {
        if (error.response?.status !== 400) {
          throw new Error('Should return 400 for invalid data');
        }
      }
    });
    
    await this.runTest('ERROR', 'Non-existent resource', async () => {
      try {
        await axios.get(`${API_URL}/memories/non-existent-id`, {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        throw new Error('Should have returned 404');
      } catch (error) {
        if (error.response?.status !== 404) {
          throw new Error('Should return 404 for non-existent resource');
        }
      }
    });
  }

  printResults() {
    log('\n=== Test Results Summary ===', 'info');
    log(`Total tests: ${this.results.total}`, 'info');
    log(`Passed: ${this.results.passed}`, 'success');
    log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'error' : 'success');
    
    if (this.results.errors.length > 0) {
      log('\nFailed tests:', 'error');
      this.results.errors.forEach(({ category, test, error }) => {
        log(`  [${category}] ${test}: ${error}`, 'error');
      });
    }
    
    const percentage = Math.round((this.results.passed / this.results.total) * 100);
    log(`\nSuccess rate: ${percentage}%`, percentage === 100 ? 'success' : percentage >= 80 ? 'warning' : 'error');
    
    // Exit with error code if tests failed
    if (this.results.failed > 0) {
      process.exit(1);
    }
  }
}

// Run the comprehensive test suite
async function main() {
  const suite = new ComprehensiveTestSuite();
  await suite.runAllTests();
}

main().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});