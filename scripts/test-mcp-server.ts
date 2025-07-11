import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';

const MCP_URL = process.env.MCP_URL || 'http://localhost:3001/mcp';

class MCPClient {
  private client: AxiosInstance;
  private sessionId?: string;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json,text/event-stream',
      },
    });
  }

  async initialize() {
    console.log('🔄 Initializing MCP session...');
    
    const initRequest = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'initialize',
      params: {
        protocolVersion: '1.0.0',
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
        capabilities: {
          tools: true,
          prompts: true,
        },
      },
    };

    try {
      const response = await this.client.post('', initRequest);
      this.sessionId = response.headers['mcp-session-id'];
      
      if (this.sessionId) {
        this.client.defaults.headers['Mcp-Session-Id'] = this.sessionId;
        console.log('✅ Session initialized:', this.sessionId);
        if (response.data?.result?.capabilities) {
          console.log('📋 Server capabilities:', JSON.stringify(response.data.result.capabilities, null, 2));
        }
      }

      // Send initialized notification
      await this.sendNotification('initialized', {});
      
      return response.data;
    } catch (error) {
      console.error('❌ Failed to initialize:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendNotification(method: string, params: any) {
    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    try {
      await this.client.post('', notification);
    } catch (error) {
      console.error(`❌ Failed to send ${method} notification:`, error.response?.data || error.message);
    }
  }

  async callTool(toolName: string, args: any) {
    const request = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };

    try {
      const response = await this.client.post('', request);
      return response.data.result;
    } catch (error) {
      console.error(`❌ Failed to call tool ${toolName}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async listTools() {
    const request = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'tools/list',
      params: {},
    };

    try {
      const response = await this.client.post('', request);
      return response.data.result.tools;
    } catch (error) {
      console.error('❌ Failed to list tools:', error.response?.data || error.message);
      throw error;
    }
  }

  async listPrompts() {
    const request = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'prompts/list',
      params: {},
    };

    try {
      const response = await this.client.post('', request);
      return response.data.result.prompts;
    } catch (error) {
      console.error('❌ Failed to list prompts:', error.response?.data || error.message);
      throw error;
    }
  }

  async getPrompt(name: string, args: any) {
    const request = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'prompts/get',
      params: {
        name,
        arguments: args,
      },
    };

    try {
      const response = await this.client.post('', request);
      return response.data.result;
    } catch (error) {
      console.error(`❌ Failed to get prompt ${name}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async close() {
    if (this.sessionId) {
      try {
        await this.client.delete('');
        console.log('✅ Session closed');
      } catch (error) {
        console.error('❌ Failed to close session:', error.response?.data || error.message);
      }
    }
  }
}

async function testMCPServer() {
  console.log('\n🧪 Testing MCP Server at', MCP_URL);
  console.log('=' . repeat(50));

  const client = new MCPClient(MCP_URL);

  try {
    // 1. Initialize session
    await client.initialize();

    // 2. List available tools
    console.log('\n📋 Available tools:');
    const tools = await client.listTools();
    tools.forEach((tool: any) => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    // 3. List modules
    console.log('\n📦 Listing memory modules...');
    const modules = await client.callTool('listModules', {});
    console.log('Modules:', JSON.stringify(modules, null, 2));

    // 4. Store a test memory
    console.log('\n💾 Storing test memory...');
    const storeResult = await client.callTool('storeMemory', {
      content: 'This is a test memory from the MCP client test script',
      metadata: {
        tags: ['test', 'mcp'],
        source: 'test-script',
      },
    });
    console.log('Store result:', JSON.stringify(storeResult, null, 2));

    // Extract memory ID from result if available
    let memoryId: string | undefined;
    if (storeResult.content?.[0]?.text) {
      const match = storeResult.content[0].text.match(/Memory stored successfully: ([\w-]+)/);
      if (match) {
        memoryId = match[1];
      }
    }

    // 5. Search memories
    console.log('\n🔍 Searching memories...');
    const searchResult = await client.callTool('searchMemories', {
      query: 'test memory MCP',
      limit: 5,
    });
    console.log('Search result:', JSON.stringify(searchResult, null, 2));

    // 6. Get specific memory if we have an ID
    if (memoryId) {
      console.log(`\n📄 Retrieving memory ${memoryId}...`);
      const memoryResult = await client.callTool('getMemory', {
        memoryId,
      });
      console.log('Memory:', JSON.stringify(memoryResult, null, 2));
    }

    // 7. Get module stats
    console.log('\n📊 Getting technical module stats...');
    const statsResult = await client.callTool('getModuleStats', {
      moduleId: 'technical',
    });
    console.log('Stats:', JSON.stringify(statsResult, null, 2));

    // 8. List prompts
    console.log('\n📝 Available prompts:');
    const prompts = await client.listPrompts();
    prompts.forEach((prompt: any) => {
      console.log(`  - ${prompt.name}: ${prompt.description}`);
    });

    // 9. Get a prompt
    if (prompts.length > 0) {
      console.log('\n🎯 Getting prompt...');
      const promptResult = await client.getPrompt('searchAndSummarize', {
        topic: 'MCP test',
        maxResults: 3,
      });
      console.log('Prompt:', JSON.stringify(promptResult, null, 2));
    }

    // 10. Check health endpoint
    console.log('\n❤️  Checking MCP health...');
    const healthResponse = await axios.get(`${MCP_URL}/health`);
    console.log('Health:', JSON.stringify(healthResponse.data, null, 2));

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Close session
    await client.close();
  }

  console.log('\n✅ MCP server test completed!');
}

// Run the test
testMCPServer().catch(console.error);