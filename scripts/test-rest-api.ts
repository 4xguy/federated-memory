import './register-paths';
import axios, { AxiosInstance } from 'axios';
import { Logger } from '../src/utils/logger';

const logger = Logger.getInstance();
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

class APITester {
  private api: AxiosInstance;
  private token?: string;
  private userId?: string;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request/response logging
    this.api.interceptors.request.use(
      config => {
        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      error => {
        logger.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.api.interceptors.response.use(
      response => {
        logger.debug(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      error => {
        if (error.response) {
          logger.error(`API Error: ${error.response.status} ${error.response.config.url}`, error.response.data);
        }
        return Promise.reject(error);
      }
    );
  }

  async testHealth() {
    logger.info('\n🏥 Testing Health Endpoints...');
    
    try {
      // Basic health check
      const health = await this.api.get('/health');
      logger.info('✓ Basic health check:', health.data);

      // Detailed health check
      const detailed = await this.api.get('/health/detailed');
      logger.info('✓ Detailed health check:', detailed.data);

      // Readiness check
      const ready = await this.api.get('/health/ready');
      logger.info('✓ Readiness check:', ready.data);

      // Liveness check
      const live = await this.api.get('/health/live');
      logger.info('✓ Liveness check:', live.data);
    } catch (error: any) {
      logger.error('✗ Health check failed:', error.response?.data || error.message);
    }
  }

  async testUserRegistration() {
    logger.info('\n👤 Testing User Registration...');
    
    try {
      const email = `test-${Date.now()}@example.com`;
      const response = await this.api.post('/users/register', {
        email,
        name: 'Test User'
      });

      this.token = response.data.token;
      this.userId = response.data.id;
      
      // Set auth header for future requests
      this.api.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
      
      logger.info('✓ User registered:', {
        id: response.data.id,
        email: response.data.email,
        hasToken: !!response.data.token
      });

      return response.data;
    } catch (error: any) {
      logger.error('✗ Registration failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async testUserLogin(email: string) {
    logger.info('\n🔐 Testing User Login...');
    
    try {
      const response = await this.api.post('/users/login', { email });
      logger.info('✓ Login successful:', {
        id: response.data.id,
        email: response.data.email
      });
      return response.data;
    } catch (error: any) {
      logger.error('✗ Login failed:', error.response?.data || error.message);
    }
  }

  async testMemoryOperations() {
    logger.info('\n🧠 Testing Memory Operations...');
    
    if (!this.token) {
      logger.error('✗ No auth token available, skipping memory tests');
      return;
    }

    try {
      // Store a memory
      logger.info('Storing memory...');
      const storeResponse = await this.api.post('/memories', {
        content: 'This is a test memory from the REST API test script. It contains important information about testing.',
        metadata: {
          type: 'test',
          priority: 'high',
          tags: ['api-test', 'automated']
        }
      });
      const memoryId = storeResponse.data.id;
      logger.info('✓ Memory stored:', memoryId);

      // Search memories
      logger.info('Searching memories...');
      const searchResponse = await this.api.get('/memories/search', {
        params: {
          query: 'test memory REST API',
          limit: 5
        }
      });
      logger.info(`✓ Search found ${searchResponse.data.count} memories`);

      // Get specific memory
      logger.info('Getting specific memory...');
      const getResponse = await this.api.get(`/memories/${memoryId}`);
      logger.info('✓ Retrieved memory:', {
        id: getResponse.data.id,
        contentLength: getResponse.data.content.length
      });

      // Update memory
      logger.info('Updating memory...');
      await this.api.put(`/memories/${memoryId}`, {
        metadata: {
          type: 'test',
          priority: 'medium',
          tags: ['api-test', 'automated', 'updated'],
          lastModified: new Date().toISOString()
        }
      });
      logger.info('✓ Memory updated');

      // Delete memory
      logger.info('Deleting memory...');
      await this.api.delete(`/memories/${memoryId}`);
      logger.info('✓ Memory deleted');

    } catch (error: any) {
      logger.error('✗ Memory operation failed:', error.response?.data || error.message);
    }
  }

  async testModuleOperations() {
    logger.info('\n📦 Testing Module Operations...');
    
    if (!this.token) {
      logger.error('✗ No auth token available, skipping module tests');
      return;
    }

    try {
      // List modules
      const modulesResponse = await this.api.get('/modules');
      logger.info(`✓ Found ${modulesResponse.data.modules.length} modules:`, 
        modulesResponse.data.modules.map((m: any) => m.id).join(', ')
      );

      // Test each module
      for (const module of modulesResponse.data.modules) {
        logger.info(`\nTesting ${module.name}...`);

        // Get module stats
        const statsResponse = await this.api.get(`/modules/${module.id}/stats`);
        logger.info(`✓ ${module.name} stats:`, statsResponse.data.stats);

        // Store a module-specific memory
        const memoryResponse = await this.api.post('/memories', {
          content: `Test memory for ${module.name} module`,
          moduleId: module.id,
          metadata: {
            testType: 'module-specific',
            moduleName: module.name
          }
        });
        logger.info(`✓ Stored memory in ${module.name}`);

        // Analyze module (if supported)
        try {
          const analysisResponse = await this.api.post(`/modules/${module.id}/analyze`, {
            options: {}
          });
          logger.info(`✓ ${module.name} analysis:`, {
            hasAnalysis: !!analysisResponse.data.analysis
          });
        } catch (error: any) {
          if (error.response?.status === 400) {
            logger.info(`ℹ ${module.name} does not support analysis`);
          } else {
            throw error;
          }
        }
      }
    } catch (error: any) {
      logger.error('✗ Module operation failed:', error.response?.data || error.message);
    }
  }

  async testUserStats() {
    logger.info('\n📊 Testing User Statistics...');
    
    if (!this.token) {
      logger.error('✗ No auth token available, skipping stats tests');
      return;
    }

    try {
      // Get current user info
      const meResponse = await this.api.get('/users/me');
      logger.info('✓ Current user:', meResponse.data);

      // Get user stats
      const statsResponse = await this.api.get('/users/stats');
      logger.info('✓ User statistics:', statsResponse.data);
    } catch (error: any) {
      logger.error('✗ Stats request failed:', error.response?.data || error.message);
    }
  }

  async cleanup() {
    logger.info('\n🧹 Cleaning up...');
    
    if (!this.token || !this.userId) {
      logger.info('No user to clean up');
      return;
    }

    try {
      await this.api.delete('/users/me');
      logger.info('✓ Test user deleted');
    } catch (error: any) {
      logger.error('✗ Cleanup failed:', error.response?.data || error.message);
    }
  }
}

async function runAPITests() {
  const tester = new APITester();

  try {
    logger.info('🚀 Starting REST API Tests...');
    logger.info(`API Base URL: ${API_BASE_URL}`);

    // Run tests in sequence
    await tester.testHealth();
    
    const user = await tester.testUserRegistration();
    if (user) {
      await tester.testUserLogin(user.email);
      await tester.testMemoryOperations();
      await tester.testModuleOperations();
      await tester.testUserStats();
    }

    logger.info('\n✅ All REST API tests completed!');
  } catch (error) {
    logger.error('Test suite failed:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

// Run tests
runAPITests().catch(console.error);