import axios from 'axios';
import { AuthService } from '../src/services/auth.service';
import { OAuthProviderService } from '../src/services/oauth-provider.service';
import { prisma } from '../src/utils/database';

async function testMCPWithOAuth() {
  console.log('Testing MCP with OAuth authentication...\n');

  try {
    // 1. Get an OAuth token
    console.log('1. Getting OAuth token for test user...');
    const authService = AuthService.getInstance();
    const oauthProvider = OAuthProviderService.getInstance();
    
    // Use existing test user
    const user = await prisma.user.findUnique({
      where: { email: 'oauth-test@example.com' }
    });
    
    if (!user) {
      console.error('Test user not found. Run test-oauth.ts first.');
      return;
    }

    // Generate fresh token
    const token = authService.generateJWT(user.id);
    console.log('✓ JWT token generated');

    // 2. Test MCP session initialization
    console.log('\n2. Initializing MCP session...');
    const mcpResponse = await axios.post(
      'http://localhost:3001/mcp',
      {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        },
        id: 1
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('✓ MCP initialized:', {
      sessionId: mcpResponse.headers['mcp-session-id'],
      serverName: mcpResponse.data.result?.serverInfo?.name
    });

    const sessionId = mcpResponse.headers['mcp-session-id'];

    // 3. Test authenticated tool call
    console.log('\n3. Testing authenticated MCP tool call...');
    const storeResponse = await axios.post(
      'http://localhost:3001/mcp',
      {
        jsonrpc: '2.0',
        method: 'tools/invoke',
        params: {
          name: 'storeMemory',
          arguments: {
            content: 'OAuth test memory: Successfully authenticated via OAuth',
            metadata: {
              test: true,
              authType: 'oauth'
            }
          }
        },
        id: 2
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': `Bearer ${token}`,
          'Mcp-Session-Id': sessionId
        }
      }
    );

    console.log('✓ Memory stored:', storeResponse.data.result);

    // 4. Search for the memory
    console.log('\n4. Searching for stored memory...');
    const searchResponse = await axios.post(
      'http://localhost:3001/mcp',
      {
        jsonrpc: '2.0',
        method: 'tools/invoke',
        params: {
          name: 'searchMemories',
          arguments: {
            query: 'OAuth test memory',
            limit: 5
          }
        },
        id: 3
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': `Bearer ${token}`,
          'Mcp-Session-Id': sessionId
        }
      }
    );

    const results = JSON.parse(searchResponse.data.result.content[0].text);
    console.log('✓ Search results:', results.length, 'memories found');
    if (results.length > 0) {
      console.log('  First result:', {
        content: results[0].content.substring(0, 50) + '...',
        module: results[0].module
      });
    }

    // 5. Test with API key
    console.log('\n5. Testing with API key authentication...');
    const apiKeys = await authService.listApiKeys(user.id);
    if (apiKeys.length === 0) {
      console.log('Generating new API key...');
      const newKey = await authService.generateApiKey(user.id, 'MCP Test Key');
      console.log('✓ API key created');
      
      // Test with API key
      const apiKeyResponse = await axios.post(
        'http://localhost:3001/mcp',
        {
          jsonrpc: '2.0',
          method: 'tools/invoke',
          params: {
            name: 'listModules',
            arguments: {}
          },
          id: 4
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newKey}`,
            'Mcp-Session-Id': sessionId
          }
        }
      );

      const modules = JSON.parse(apiKeyResponse.data.result.content[0].text);
      console.log('✓ API key auth successful. Modules:', modules.map((m: any) => m.id).join(', '));
    }

  } catch (error: any) {
    console.error('Test failed:', error.response?.data || error.message);
    if (error.response?.data?.error) {
      console.error('Error details:', error.response.data.error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testMCPWithOAuth();