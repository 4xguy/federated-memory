const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const TOKEN = 'd2a5f016-e241-43a4-bdf6-fb6b0502514f'; // Using the test user token

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

async function testProjectEndpoints() {
  log('\n=== Testing Project Endpoints ===\n', 'info');
  
  // Get a fresh token first
  let token = TOKEN;
  try {
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'TestPassword123!'
    });
    token = loginResponse.data.token;
    log('✓ Got fresh token', 'success');
  } catch (error) {
    log('Using existing token', 'warning');
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  let projectId = null;
  let taskId = null;

  // Test 1: Create a project
  log('\n1. Testing project creation...', 'info');
  try {
    const projectResponse = await axios.post(`${API_URL}/projects/projects`, {
      name: 'Test Project',
      description: 'A test project for endpoint verification',
      status: 'active',
      owner: 'test@example.com',
      team: ['test@example.com'],
      ministry: 'Technology',
      progress: 0
    }, { headers });
    
    log('✓ Project created successfully', 'success');
    projectId = projectResponse.data.id;
    console.log('Project ID:', projectId);
    console.log('Project:', projectResponse.data);
  } catch (error) {
    log(`✗ Project creation failed: ${error.response?.data?.error || error.message}`, 'error');
    console.log('Error details:', error.response?.data);
  }

  // Test 2: List projects
  log('\n2. Testing project listing...', 'info');
  try {
    const listResponse = await axios.get(`${API_URL}/projects/projects`, { headers });
    log('✓ Projects listed successfully', 'success');
    console.log('Total projects:', Array.isArray(listResponse.data) ? listResponse.data.length : listResponse.data.projects?.length || 0);
    const projects = Array.isArray(listResponse.data) ? listResponse.data : listResponse.data.projects || [];
    console.log('First project:', projects[0]);
  } catch (error) {
    log(`✗ Project listing failed: ${error.response?.data?.error || error.message}`, 'error');
  }

  // Test 3: Get specific project
  if (projectId) {
    log('\n3. Testing get specific project...', 'info');
    try {
      const getResponse = await axios.get(`${API_URL}/projects/projects/${projectId}`, { headers });
      log('✓ Project retrieved successfully', 'success');
      console.log('Project details:', getResponse.data);
    } catch (error) {
      log(`✗ Project retrieval failed: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  // Test 4: Create a task
  log('\n4. Testing task creation...', 'info');
  try {
    const taskResponse = await axios.post(`${API_URL}/projects/tasks`, {
      title: 'Test Task',
      description: 'A test task for the project',
      status: 'todo',
      priority: 'medium',
      projectId: projectId,
      assignee: 'test@example.com',
      estimatedHours: 2
    }, { headers });
    
    log('✓ Task created successfully', 'success');
    taskId = taskResponse.data.id;
    console.log('Task ID:', taskId);
    console.log('Task:', taskResponse.data);
  } catch (error) {
    log(`✗ Task creation failed: ${error.response?.data?.error || error.message}`, 'error');
    console.log('Error details:', error.response?.data);
  }

  // Test 5: List tasks
  log('\n5. Testing task listing...', 'info');
  try {
    const tasksResponse = await axios.get(`${API_URL}/projects/tasks`, { headers });
    log('✓ Tasks listed successfully', 'success');
    console.log('Total tasks:', Array.isArray(tasksResponse.data) ? tasksResponse.data.length : tasksResponse.data.tasks?.length || 0);
    const tasks = Array.isArray(tasksResponse.data) ? tasksResponse.data : tasksResponse.data.tasks || [];
    if (tasks.length > 0) {
      console.log('First task:', tasks[0]);
    }
  } catch (error) {
    log(`✗ Task listing failed: ${error.response?.data?.error || error.message}`, 'error');
  }

  // Test 6: Update task status
  if (taskId) {
    log('\n6. Testing task status update...', 'info');
    try {
      const updateResponse = await axios.put(`${API_URL}/projects/tasks/${taskId}`, {
        status: 'in_progress'
      }, { headers });
      
      log('✓ Task status updated successfully', 'success');
      console.log('Updated task:', updateResponse.data);
    } catch (error) {
      log(`✗ Task update failed: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  // Test 7: Get project tasks
  if (projectId) {
    log('\n7. Testing get project tasks...', 'info');
    try {
      const projectTasksResponse = await axios.get(`${API_URL}/projects/projects/${projectId}/tasks`, { headers });
      log('✓ Project tasks retrieved successfully', 'success');
      const projectTasks = Array.isArray(projectTasksResponse.data) ? projectTasksResponse.data : projectTasksResponse.data.tasks || [];
      console.log('Project tasks count:', projectTasks.length);
    } catch (error) {
      log(`✗ Project tasks retrieval failed: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  // Test 8: Delete task
  if (taskId) {
    log('\n8. Testing task deletion...', 'info');
    try {
      await axios.delete(`${API_URL}/projects/tasks/${taskId}`, { headers });
      log('✓ Task deleted successfully', 'success');
    } catch (error) {
      log(`✗ Task deletion failed: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  // Test 9: Delete project
  if (projectId) {
    log('\n9. Testing project deletion...', 'info');
    try {
      await axios.delete(`${API_URL}/projects/projects/${projectId}`, { headers });
      log('✓ Project deleted successfully', 'success');
    } catch (error) {
      log(`✗ Project deletion failed: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  log('\n=== Project Endpoints Testing Complete ===\n', 'info');
}

// Run the tests
testProjectEndpoints().catch(console.error);