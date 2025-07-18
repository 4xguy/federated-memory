#!/usr/bin/env node

const readline = require('readline');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  console.log('Starting MCP client...');
  
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['mcp-remote', 'http://localhost:3001/mcp']
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  });

  try {
    await client.connect(transport);
    console.log('Connected to MCP server\!');

    // List available tools
    const tools = await client.listTools();
    console.log('\nAvailable tools:');
    tools.tools.forEach(tool => {
      console.log(`- ${tool.name}: ${tool.description}`);
    });

    // Test storing a memory
    console.log('\n--- Testing storeMemory ---');
    const storeResult = await client.callTool('storeMemory', {
      content: 'Test memory from interactive client: MCP integration is working',
      metadata: { source: 'interactive-test', timestamp: new Date().toISOString() }
    });
    console.log('Store result:', JSON.stringify(storeResult, null, 2));

    // Test searching for the memory
    console.log('\n--- Testing searchMemories ---');
    const searchResult = await client.callTool('searchMemories', {
      query: 'interactive client MCP',
      limit: 5
    });
    console.log('Search result:', JSON.stringify(searchResult, null, 2));

    // Test listing modules
    console.log('\n--- Testing listModules ---');
    const modulesResult = await client.callTool('listModules', {});
    console.log('Modules result:', JSON.stringify(modulesResult, null, 2));

    await client.close();
    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
EOF < /dev/null
