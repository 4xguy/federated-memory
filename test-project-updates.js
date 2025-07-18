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
  blue: '\x1b[34m'
};

function log(message, type = 'info') {
  const color = type === 'success' ? colors.green : 
                type === 'error' ? colors.red : 
                type === 'warning' ? colors.yellow : colors.blue;
  console.log(`${color}${message}${colors.reset}`);
}

async function testProjectOperations() {
  let testUser, token, projectId, taskId;
  
  try {
    log('\n=== Testing Project and Task Operations ===\n', 'info');
    
    // Setup
    const email = `test-${Date.now()}@example.com`;
    const password = 'TestPassword123!';
    const passwordHash = await bcrypt.hash(password, 10);
    
    testUser = await prisma.user.create({
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
    
    // Login
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email,
      password
    });
    
    token = loginResponse.data.token;
    log('Authentication successful', 'success');
    
    // 1. Create Project
    log('\n1. Creating project...', 'info');
    const projectResponse = await axios.post(`${API_URL}/projects/projects`, {
      name: 'Test Project for Updates',
      description: 'Testing project update functionality',
      status: 'active'
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    projectId = projectResponse.data.id;
    log(`✅ Project created: ${projectId}`, 'success');
    
    // 2. Update Project
    log('\n2. Updating project...', 'info');
    try {
      const updateResponse = await axios.put(`${API_URL}/projects/projects/${projectId}`, {
        status: 'on_hold',
        progress: 50,
        description: 'Updated description'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      log(`✅ Project updated successfully`, 'success');
      console.log('Updated project:', updateResponse.data);
    } catch (error) {
      log(`❌ Project update failed: ${error.message}`, 'error');
      if (error.response?.data) {
        console.log('Error response:', error.response.data);
      }
    }
    
    // 3. Create Task
    log('\n3. Creating task...', 'info');
    const taskResponse = await axios.post(`${API_URL}/projects/tasks`, {
      title: 'Test Task for Updates',
      description: 'Testing task update functionality',
      projectId: projectId,
      status: 'todo',
      priority: 'high'
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    taskId = taskResponse.data.id;
    log(`✅ Task created: ${taskId}`, 'success');
    
    // 4. Update Task
    log('\n4. Updating task...', 'info');
    try {
      const updateTaskResponse = await axios.put(`${API_URL}/projects/tasks/${taskId}`, {
        status: 'in_progress',
        actualHours: 2,
        description: 'Updated task description'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      log(`✅ Task updated successfully`, 'success');
      console.log('Updated task:', updateTaskResponse.data);
    } catch (error) {
      log(`❌ Task update failed: ${error.message}`, 'error');
      if (error.response?.data) {
        console.log('Error response:', error.response.data);
      }
    }
    
    // 5. Test Delete Operations
    log('\n5. Testing delete operations...', 'info');
    
    // Delete task first
    try {
      await axios.delete(`${API_URL}/projects/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      log('✅ Task deleted successfully', 'success');
    } catch (error) {
      log(`❌ Task deletion failed: ${error.message}`, 'error');
    }
    
    // Delete project
    try {
      await axios.delete(`${API_URL}/projects/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      log('✅ Project deleted successfully', 'success');
    } catch (error) {
      log(`❌ Project deletion failed: ${error.message}`, 'error');
    }
    
  } catch (error) {
    log(`\n💥 Fatal error: ${error.message}`, 'error');
    console.error(error);
  } finally {
    // Cleanup
    if (testUser) {
      await prisma.user.delete({
        where: { id: testUser.id }
      }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

testProjectOperations();