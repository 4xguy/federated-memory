export { createMcpServer, createMcpApp } from './server';

// Re-export types that might be useful
export type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
export type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';