import axios from 'axios';
import { logger } from '../src/utils/logger';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
const TEST_USER_ID = 'test-user-123';
const TEST_TOKEN = 'test-jwt-token'; // In production, this would be a real JWT

interface TestResult {
  endpoint: string;
  method: string;
  status: 'pass' | 'fail';
  statusCode?: number;
  error?: string;
  responseTime: number;
}

const results: TestResult[] = [];

async function testEndpoint(
  method: string,
  endpoint: string,
  data?: any,
  description?: string
): Promise<void> {
  const startTime = Date.now();
  
  try {
    const response = await axios({
      method,
      url: `${API_BASE_URL}${endpoint}`,
      data,
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true, // Don't throw on non-2xx status
    });

    const responseTime = Date.now() - startTime;
    const status = response.status >= 200 && response.status < 300 ? 'pass' : 'fail';
    
    results.push({
      endpoint,
      method,
      status,
      statusCode: response.status,
      responseTime,
      error: status === 'fail' ? response.data?.error : undefined,
    });

    logger.info(`${status === 'pass' ? '✅' : '❌'} ${method} ${endpoint} - ${response.status} (${responseTime}ms)${description ? ' - ' + description : ''}`);
    
    if (response.data && status === 'pass') {
      logger.debug('Response data:', JSON.stringify(response.data, null, 2));
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    results.push({
      endpoint,
      method,
      status: 'fail',
      error: error.message,
      responseTime,
    });

    logger.error(`❌ ${method} ${endpoint} - Error: ${error.message} (${responseTime}ms)`);
  }
}

async function runTests() {
  logger.info('🧪 Testing REST API Endpoints...\n');
  
  // Test health check
  await testEndpoint('GET', '/health', undefined, 'Health check');
  
  // Test people endpoints
  logger.info('\n📋 Testing People Endpoints:');
  
  // List people
  await testEndpoint('GET', '/people', undefined, 'List all people');
  
  // Search people
  await testEndpoint('GET', '/people/search?query=john', undefined, 'Search for "john"');
  
  // Create a person
  const newPerson = {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    membershipStatus: 'guest',
    tags: ['new', 'test'],
  };
  await testEndpoint('POST', '/people', newPerson, 'Create new person');
  
  // Get specific person (will fail with test data)
  await testEndpoint('GET', '/people/123', undefined, 'Get person by ID');
  
  // Update person (will fail with test data)
  await testEndpoint('PUT', '/people/123', { firstName: 'Updated' }, 'Update person');
  
  // Test analytics endpoints
  logger.info('\n📊 Testing Analytics Endpoints:');
  
  await testEndpoint('GET', '/analytics/dashboard', undefined, 'Dashboard metrics');
  await testEndpoint('GET', '/analytics/attendance', undefined, 'Attendance analytics');
  await testEndpoint('GET', '/analytics/giving', undefined, 'Giving analytics');
  await testEndpoint('GET', '/analytics/groups', undefined, 'Groups analytics');
  await testEndpoint('GET', '/analytics/ministries', undefined, 'Ministry statistics');
  
  // Test projects endpoints
  logger.info('\n📁 Testing Project Endpoints:');
  
  await testEndpoint('GET', '/projects', undefined, 'List all projects');
  await testEndpoint('POST', '/projects', {
    name: 'Test Project',
    description: 'Testing REST API',
    status: 'planning',
  }, 'Create new project');
  
  // Test tasks endpoints
  logger.info('\n✅ Testing Task Endpoints:');
  
  await testEndpoint('GET', '/tasks', undefined, 'List all tasks');
  await testEndpoint('POST', '/tasks', {
    title: 'Test Task',
    description: 'Testing task creation',
    priority: 'medium',
  }, 'Create new task');
  
  // Print summary
  logger.info('\n📊 Test Summary:');
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const avgResponseTime = results.reduce((acc, r) => acc + r.responseTime, 0) / results.length;
  
  logger.info(`Total tests: ${results.length}`);
  logger.info(`Passed: ${passed} ✅`);
  logger.info(`Failed: ${failed} ❌`);
  logger.info(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
  
  if (failed > 0) {
    logger.info('\n❌ Failed tests:');
    results
      .filter(r => r.status === 'fail')
      .forEach(r => {
        logger.error(`${r.method} ${r.endpoint}: ${r.error || `Status ${r.statusCode}`}`);
      });
  }
  
  // Exit with error code if tests failed
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  logger.error('Test runner failed:', error);
  process.exit(1);
});