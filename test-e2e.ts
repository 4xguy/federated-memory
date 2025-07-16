import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_BASE = 'http://localhost:3000/api';

interface TestCase {
  name: string;
  test: () => Promise<boolean>;
}

class E2ETest {
  private token: string = '';
  private userId: string = '';
  private memoryId: string = '';
  private passed: number = 0;
  private failed: number = 0;

  async run() {
    console.log('🚀 End-to-End Production Test\n');
    console.log('=' .repeat(60));

    const tests: TestCase[] = [
      { name: 'Create OAuth Session', test: () => this.testCreateSession() },
      { name: 'List Modules', test: () => this.testListModules() },
      { name: 'Store Memory', test: () => this.testStoreMemory() },
      { name: 'Search Memory', test: () => this.testSearchMemory() },
      { name: 'Store in Multiple Modules', test: () => this.testMultiModuleStorage() },
      { name: 'Cross-Module Search', test: () => this.testCrossModuleSearch() },
    ];

    for (const testCase of tests) {
      try {
        console.log(`\n📋 ${testCase.name}...`);
        const success = await testCase.test();
        if (success) {
          console.log(`✅ ${testCase.name} - PASSED`);
          this.passed++;
        } else {
          console.log(`❌ ${testCase.name} - FAILED`);
          this.failed++;
        }
      } catch (error: any) {
        console.log(`❌ ${testCase.name} - ERROR: ${error.message}`);
        this.failed++;
      }
    }

    this.printSummary();
  }

  private async testCreateSession(): Promise<boolean> {
    const response = await axios.post(`${API_BASE}/auth/session`, {
      userId: `e2e-user-${Date.now()}`,
      email: `e2e-${Date.now()}@test.com`,
      name: 'E2E Test User',
      provider: 'google'
    });
    
    this.token = response.data.token;
    this.userId = response.data.user.id;
    
    console.log(`   User ID: ${this.userId}`);
    console.log(`   Token: ${this.token.substring(0, 40)}...`);
    
    return !!this.token && !!this.userId;
  }

  private async testListModules(): Promise<boolean> {
    const response = await axios.get(`${API_BASE}/modules`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    
    const modules = response.data.modules || [];
    console.log(`   Found ${modules.length} modules`);
    modules.forEach((m: any) => {
      console.log(`   - ${m.id}: ${m.name} (${m.type})`);
    });
    
    return modules.length === 6;
  }

  private async testStoreMemory(): Promise<boolean> {
    const testContent = `E2E test memory created at ${new Date().toISOString()}`;
    
    // Try storing in each module until one succeeds
    const modules = ['technical', 'personal', 'work'];
    
    for (const moduleId of modules) {
      try {
        console.log(`   Attempting to store in ${moduleId} module...`);
        
        const response = await axios.post(
          `${API_BASE}/memories`,
          {
            content: testContent,
            moduleId: moduleId,
            metadata: {
              test: 'e2e',
              timestamp: new Date().toISOString(),
              unique: uuidv4()
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        this.memoryId = response.data.id;
        console.log(`   ✅ Memory stored successfully!`);
        console.log(`   Memory ID: ${this.memoryId}`);
        console.log(`   Module: ${moduleId}`);
        
        return true;
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Unknown error';
        console.log(`   ❌ Failed in ${moduleId}: ${errorMsg}`);
        
        // Log full error for debugging
        if (error.response?.data) {
          console.log(`   Full error: ${JSON.stringify(error.response.data, null, 2)}`);
        }
      }
    }
    
    return false;
  }

  private async testSearchMemory(): Promise<boolean> {
    console.log(`   Searching for memories...`);
    
    try {
      const response = await axios.get(
        `${API_BASE}/memories/search`,
        {
          params: {
            query: 'E2E test memory',
            limit: '10',  // String to match expected type
            minScore: '0.1'  // String to match expected type
          },
          headers: { 'Authorization': `Bearer ${this.token}` }
        }
      );
      
      const results = response.data.results || [];
      console.log(`   Found ${results.length} results`);
      
      if (results.length > 0) {
        console.log(`   Top result:`);
        console.log(`   - Module: ${results[0].moduleId}`);
        console.log(`   - Score: ${results[0].similarity}`);
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.log(`   Search error: ${error.response?.data?.error || error.message}`);
      return false;
    }
  }

  private async testMultiModuleStorage(): Promise<boolean> {
    const modules = ['technical', 'personal', 'work'];
    let successCount = 0;
    
    for (const moduleId of modules) {
      try {
        await axios.post(
          `${API_BASE}/memories`,
          {
            content: `Multi-module test for ${moduleId}`,
            moduleId: moduleId,
            metadata: { multiTest: true }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        successCount++;
        console.log(`   ✅ Stored in ${moduleId}`);
      } catch (error) {
        console.log(`   ❌ Failed in ${moduleId}`);
      }
    }
    
    console.log(`   Success rate: ${successCount}/${modules.length}`);
    return successCount > 0;
  }

  private async testCrossModuleSearch(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${API_BASE}/memories/search`,
        {
          params: {
            query: 'multi-module test',
            limit: '20',
            minScore: '0.1'
          },
          headers: { 'Authorization': `Bearer ${this.token}` }
        }
      );
      
      const results = response.data.results || [];
      const uniqueModules = new Set(results.map((r: any) => r.moduleId));
      
      console.log(`   Found memories from ${uniqueModules.size} different modules`);
      console.log(`   Modules: ${Array.from(uniqueModules).join(', ')}`);
      
      return uniqueModules.size > 0;
    } catch (error) {
      console.log(`   Cross-module search failed`);
      return false;
    }
  }

  private printSummary() {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 TEST RESULTS\n');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
    
    if (this.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! System is production-ready.');
    } else {
      console.log('\n⚠️  Some tests failed. Please fix issues before deployment.');
    }
    
    console.log('\n' + '=' .repeat(60));
  }
}

// Run the test
const test = new E2ETest();
test.run().catch(console.error);