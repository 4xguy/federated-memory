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
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, type = 'info') {
  const color = type === 'success' ? colors.green : 
                type === 'error' ? colors.red : 
                type === 'warning' ? colors.yellow : 
                type === 'test' ? colors.magenta :
                type === 'section' ? colors.cyan : colors.blue;
  console.log(`${color}${message}${colors.reset}`);
}

class FeatureVerificationSuite {
  constructor() {
    this.testUser = null;
    this.token = null;
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      features: {}
    };
  }

  async setup() {
    log('\n=== Test Setup ===', 'section');
    
    // Create a test user
    const email = `verify-${Date.now()}@example.com`;
    const password = 'TestPassword123!';
    const passwordHash = await bcrypt.hash(password, 10);
    
    this.testUser = await prisma.user.create({
      data: {
        id: uuidv4(),
        token: uuidv4(),
        email,
        passwordHash,
        emailVerified: true,
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
    log(`Authentication successful`, 'success');
  }

  async cleanup() {
    log('\n=== Cleanup ===', 'section');
    
    try {
      if (this.testUser) {
        await prisma.user.delete({
          where: { id: this.testUser.id }
        });
        log('Test data cleaned up', 'success');
      }
    } catch (error) {
      log(`Cleanup error: ${error.message}`, 'warning');
    }
    
    await prisma.$disconnect();
  }

  async runTest(feature, name, testFn) {
    this.results.total++;
    
    if (!this.results.features[feature]) {
      this.results.features[feature] = { total: 0, passed: 0, failed: 0 };
    }
    this.results.features[feature].total++;
    
    log(`  ${name}`, 'test');
    
    try {
      const result = await testFn();
      this.results.passed++;
      this.results.features[feature].passed++;
      log(`    ✅ PASSED${result ? ': ' + result : ''}`, 'success');
      return true;
    } catch (error) {
      this.results.failed++;
      this.results.features[feature].failed++;
      log(`    ❌ FAILED: ${error.message}`, 'error');
      if (error.response?.data) {
        console.log('    Response:', JSON.stringify(error.response.data, null, 2));
      }
      return false;
    }
  }

  async verifyAllFeatures() {
    log('\n🚀 FEDERATED MEMORY - FEATURE VERIFICATION SUITE', 'section');
    log('================================================', 'section');
    
    try {
      await this.setup();
      
      // 1. Memory Operations
      await this.verifyMemoryOperations();
      
      // 2. Search Functionality
      await this.verifySearchFunctionality();
      
      // 3. Project Management
      await this.verifyProjectManagement();
      
      // 4. Task Management
      await this.verifyTaskManagement();
      
      // 5. Authentication
      await this.verifyAuthentication();
      
      // 6. Module System
      await this.verifyModuleSystem();
      
    } finally {
      await this.cleanup();
      this.printResults();
    }
  }

  async verifyMemoryOperations() {
    log('\n📝 MEMORY OPERATIONS', 'section');
    
    let memoryId;
    
    await this.runTest('Memory', 'Store memory with metadata', async () => {
      const response = await axios.post(`${API_URL}/memories`, {
        content: 'This is a test memory for verification',
        title: 'Verification Memory',
        metadata: {
          category: 'test',
          tags: ['verification', 'test'],
          importance: 'high'
        }
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      memoryId = response.data.id;
      return `ID: ${memoryId}`;
    });
    
    await this.runTest('Memory', 'Retrieve memory by ID', async () => {
      const response = await axios.get(`${API_URL}/memories/${memoryId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.data.content !== 'This is a test memory for verification') {
        throw new Error('Content mismatch');
      }
      return 'Content verified';
    });
    
    await this.runTest('Memory', 'Update memory', async () => {
      const response = await axios.put(`${API_URL}/memories/${memoryId}`, {
        content: 'Updated test memory content',
        metadata: {
          category: 'test',
          tags: ['verification', 'test', 'updated'],
          importance: 'medium'
        }
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      return 'Updated successfully';
    });
    
    await this.runTest('Memory', 'List all memories', async () => {
      const response = await axios.get(`${API_URL}/memories`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (!Array.isArray(response.data.memories)) {
        throw new Error('Expected memories array');
      }
      return `Found ${response.data.memories.length} memories`;
    });
    
    await this.runTest('Memory', 'Delete memory', async () => {
      await axios.delete(`${API_URL}/memories/${memoryId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      // Verify deletion
      try {
        await axios.get(`${API_URL}/memories/${memoryId}`, {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        throw new Error('Memory should be deleted');
      } catch (error) {
        if (error.response?.status === 404) {
          return 'Deletion confirmed';
        }
        throw error;
      }
    });
  }

  async verifySearchFunctionality() {
    log('\n🔍 SEARCH FUNCTIONALITY', 'section');
    
    // Create test memories
    const memories = [];
    for (let i = 0; i < 3; i++) {
      const response = await axios.post(`${API_URL}/memories`, {
        content: `Search test memory ${i}: ${i === 0 ? 'JavaScript programming' : i === 1 ? 'Python development' : 'Machine learning'}`,
        title: `Search Test ${i}`,
        metadata: { 
          category: 'search-test',
          index: i 
        }
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      memories.push(response.data.id);
    }
    
    await this.runTest('Search', 'Search by keyword', async () => {
      const response = await axios.get(`${API_URL}/memories/search`, {
        params: {
          query: 'programming',
          limit: 10
        },
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (!response.data.results || response.data.results.length === 0) {
        throw new Error('No search results');
      }
      return `Found ${response.data.results.length} results`;
    });
    
    await this.runTest('Search', 'Search with filters', async () => {
      const response = await axios.get(`${API_URL}/memories/search`, {
        params: {
          query: 'test',
          moduleId: 'personal',
          limit: 5
        },
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      return `Module-filtered search working`;
    });
    
    await this.runTest('Search', 'Semantic search', async () => {
      const response = await axios.get(`${API_URL}/memories/search`, {
        params: {
          query: 'software development coding',
          limit: 10
        },
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      // Should find programming-related memories
      const hasRelevantResults = response.data.results.some(r => 
        r.content.toLowerCase().includes('programming') || 
        r.content.toLowerCase().includes('development')
      );
      
      if (!hasRelevantResults) {
        throw new Error('Semantic search not finding relevant results');
      }
      return 'Semantic search working';
    });
    
    // Cleanup
    for (const id of memories) {
      await axios.delete(`${API_URL}/memories/${id}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
    }
  }

  async verifyProjectManagement() {
    log('\n📊 PROJECT MANAGEMENT', 'section');
    
    let projectId;
    
    await this.runTest('Project', 'Create project', async () => {
      const response = await axios.post(`${API_URL}/projects/projects`, {
        name: 'Verification Test Project',
        description: 'Testing all project features',
        status: 'active',
        team: [this.testUser.email],
        ministry: 'Technology',
        startDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      projectId = response.data.id;
      return `Project ID: ${projectId}`;
    });
    
    await this.runTest('Project', 'Get project details', async () => {
      const response = await axios.get(`${API_URL}/projects/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.data.name !== 'Verification Test Project') {
        throw new Error('Project data mismatch');
      }
      return 'Project data verified';
    });
    
    await this.runTest('Project', 'Update project', async () => {
      const response = await axios.put(`${API_URL}/projects/projects/${projectId}`, {
        status: 'on_hold',
        progress: 25
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.data.status !== 'on_hold' || response.data.progress !== 25) {
        throw new Error('Update not applied');
      }
      return 'Update successful';
    });
    
    await this.runTest('Project', 'List projects', async () => {
      const response = await axios.get(`${API_URL}/projects/projects`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      const projects = Array.isArray(response.data) ? response.data : response.data.projects;
      if (!projects || projects.length === 0) {
        throw new Error('No projects found');
      }
      return `Found ${projects.length} projects`;
    });
    
    await this.runTest('Project', 'Delete project', async () => {
      await axios.delete(`${API_URL}/projects/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      return 'Project deleted';
    });
  }

  async verifyTaskManagement() {
    log('\n✅ TASK MANAGEMENT', 'section');
    
    // Create a project first
    const projectResponse = await axios.post(`${API_URL}/projects/projects`, {
      name: 'Task Test Project',
      description: 'Project for task testing'
    }, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    const projectId = projectResponse.data.id;
    
    let taskId;
    
    await this.runTest('Task', 'Create task', async () => {
      const response = await axios.post(`${API_URL}/projects/tasks`, {
        title: 'Verification Test Task',
        description: 'Testing task operations',
        projectId: projectId,
        status: 'todo',
        priority: 'high',
        assignee: this.testUser.email,
        estimatedHours: 4,
        tags: ['test', 'verification']
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      taskId = response.data.id;
      return `Task ID: ${taskId}`;
    });
    
    await this.runTest('Task', 'Get task details', async () => {
      const response = await axios.get(`${API_URL}/projects/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.data.title !== 'Verification Test Task') {
        throw new Error('Task data mismatch');
      }
      return 'Task data verified';
    });
    
    await this.runTest('Task', 'Update task status', async () => {
      const response = await axios.put(`${API_URL}/projects/tasks/${taskId}`, {
        status: 'in_progress',
        actualHours: 2
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.data.status !== 'in_progress') {
        throw new Error('Status update failed');
      }
      return 'Status updated to in_progress';
    });
    
    await this.runTest('Task', 'Add subtask', async () => {
      const response = await axios.post(`${API_URL}/projects/tasks/${taskId}/subtasks`, {
        title: 'Subtask 1',
        description: 'First subtask',
        assignee: this.testUser.email
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      return 'Subtask added';
    });
    
    await this.runTest('Task', 'List project tasks', async () => {
      const response = await axios.get(`${API_URL}/projects/projects/${projectId}/tasks`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      const tasks = Array.isArray(response.data) ? response.data : response.data.tasks;
      if (!tasks || tasks.length === 0) {
        throw new Error('No tasks found');
      }
      return `Found ${tasks.length} tasks`;
    });
    
    await this.runTest('Task', 'Complete task', async () => {
      const response = await axios.put(`${API_URL}/projects/tasks/${taskId}`, {
        status: 'done',
        actualHours: 4
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.data.status !== 'done') {
        throw new Error('Task completion failed');
      }
      return 'Task completed';
    });
    
    await this.runTest('Task', 'Delete task', async () => {
      await axios.delete(`${API_URL}/projects/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      return 'Task deleted';
    });
    
    // Cleanup project
    await axios.delete(`${API_URL}/projects/projects/${projectId}`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
  }

  async verifyAuthentication() {
    log('\n🔐 AUTHENTICATION', 'section');
    
    await this.runTest('Auth', 'Token validation', async () => {
      const response = await axios.get(`${API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.data.email !== this.testUser.email) {
        throw new Error('User data mismatch');
      }
      return 'Token valid';
    });
    
    await this.runTest('Auth', 'Invalid token rejection', async () => {
      try {
        await axios.get(`${API_URL}/users/me`, {
          headers: { 'Authorization': 'Bearer invalid-token' }
        });
        throw new Error('Should reject invalid token');
      } catch (error) {
        if (error.response?.status === 401) {
          return 'Invalid token rejected';
        }
        throw error;
      }
    });
    
    await this.runTest('Auth', 'Token rotation', async () => {
      const response = await axios.post(`${API_URL}/auth/rotate`, {
        currentToken: this.token
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      const newToken = response.data.token;
      
      // Verify new token works
      const verifyResponse = await axios.get(`${API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${newToken}` }
      });
      
      if (verifyResponse.status === 200) {
        this.token = newToken; // Update for future tests
        return 'Token rotated successfully';
      }
      throw new Error('New token invalid');
    });
  }

  async verifyModuleSystem() {
    log('\n🧩 MODULE SYSTEM', 'section');
    
    await this.runTest('Module', 'List available modules', async () => {
      const response = await axios.get(`${API_URL}/modules`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (!Array.isArray(response.data)) {
        throw new Error('Expected modules array');
      }
      
      const expectedModules = ['technical', 'personal', 'work', 'learning', 'communication', 'creative'];
      const hasAllModules = expectedModules.every(m => 
        response.data.some(mod => mod.id === m)
      );
      
      if (!hasAllModules) {
        throw new Error('Missing expected modules');
      }
      return `Found ${response.data.length} modules`;
    });
    
    await this.runTest('Module', 'Store in specific module', async () => {
      const response = await axios.post(`${API_URL}/memories`, {
        content: 'Technical documentation test',
        title: 'Module Test',
        moduleId: 'technical',
        metadata: {
          type: 'documentation',
          language: 'javascript'
        }
      }, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.data.moduleId !== 'technical') {
        throw new Error('Module assignment failed');
      }
      
      // Cleanup
      await axios.delete(`${API_URL}/memories/${response.data.id}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      return 'Module-specific storage working';
    });
  }

  printResults() {
    log('\n' + '='.repeat(60), 'section');
    log('📊 FINAL RESULTS', 'section');
    log('='.repeat(60), 'section');
    
    // Overall results
    const percentage = Math.round((this.results.passed / this.results.total) * 100);
    log(`\nOverall: ${this.results.passed}/${this.results.total} tests passed (${percentage}%)`, 
        percentage === 100 ? 'success' : percentage >= 90 ? 'warning' : 'error');
    
    // Per-feature breakdown
    log('\nFeature Breakdown:', 'info');
    for (const [feature, stats] of Object.entries(this.results.features)) {
      const featurePercentage = Math.round((stats.passed / stats.total) * 100);
      const status = featurePercentage === 100 ? '✅' : featurePercentage >= 50 ? '⚠️' : '❌';
      log(`  ${status} ${feature}: ${stats.passed}/${stats.total} (${featurePercentage}%)`, 
          featurePercentage === 100 ? 'success' : featurePercentage >= 50 ? 'warning' : 'error');
    }
    
    if (this.results.failed > 0) {
      log('\n⚠️  Some tests failed. Check the output above for details.', 'warning');
    } else {
      log('\n🎉 All features verified successfully!', 'success');
    }
    
    log('\n' + '='.repeat(60), 'section');
  }
}

// Run the verification suite
async function main() {
  const suite = new FeatureVerificationSuite();
  await suite.verifyAllFeatures();
}

main().catch(error => {
  log(`\n💥 Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});