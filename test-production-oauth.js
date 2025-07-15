#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function testProductionOAuth() {
  console.log('Testing OAuth on production MCP server...\n');

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['mcp-remote', 'https://federated-memory-production.up.railway.app/mcp']
  });

  const client = new Client({
    name: 'oauth-test-client',
    version: '1.0.0'
  });

  try {
    console.log('1. Connecting to production MCP server...');
    await client.connect(transport);
    console.log('✓ Connected successfully\n');

    // List available tools
    console.log('2. Listing available tools...');
    const tools = await client.listTools();
    console.log('Available tools:');
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log();

    // Try calling a PUBLIC tool first
    console.log('3. Testing PUBLIC tool (listModules)...');
    try {
      const modulesResult = await client.callTool('listModules', {});
      console.log('✓ Public tool worked without auth');
      console.log('Modules:', JSON.parse(modulesResult.content[0].text).map(m => m.id).join(', '));
    } catch (error) {
      console.log('✗ Public tool failed:', error.message);
    }
    console.log();

    // Now try a PROTECTED tool to trigger OAuth
    console.log('4. Testing PROTECTED tool (storeMemory) - should trigger OAuth...');
    try {
      const storeResult = await client.callTool('storeMemory', {
        content: 'OAuth test memory: Testing authentication flow',
        metadata: { 
          test: true, 
          timestamp: new Date().toISOString(),
          source: 'oauth-test'
        }
      });
      console.log('✗ Unexpected: Store succeeded without auth!');
      console.log('Result:', storeResult);
    } catch (error) {
      console.log('✓ Expected OAuth error received!');
      console.log('Error code:', error.code);
      console.log('Error message:', error.message);
      
      if (error.data) {
        console.log('\nOAuth details:');
        console.log('  Type:', error.data.type);
        console.log('  Resource server:', error.data.resource_server);
        console.log('  Resource metadata:', error.data.resource_metadata);
        console.log('  WWW-Authenticate:', error.data.www_authenticate);
      }
    }
    console.log();

    // Try another protected tool
    console.log('5. Testing another PROTECTED tool (searchMemories)...');
    try {
      const searchResult = await client.callTool('searchMemories', {
        query: 'test',
        limit: 5
      });
      console.log('✗ Unexpected: Search succeeded without auth!');
      console.log('Result:', searchResult);
    } catch (error) {
      console.log('✓ Expected OAuth error received!');
      console.log('Error:', error.message);
    }

    await client.close();
    console.log('\n✓ Test completed. OAuth is properly configured for protected tools.');

  } catch (error) {
    console.error('\n✗ Connection error:', error);
    console.error('Details:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testProductionOAuth().catch(console.error);