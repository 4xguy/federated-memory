import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '@/utils/logger';

export interface AuthenticatedRequest {
  method: string;
  params?: any;
  userId?: string;
}

/**
 * Creates an authentication interceptor for MCP server
 * This intercepts tool calls and returns proper OAuth errors when auth is required
 */
export function createAuthInterceptor(server: McpServer, userId?: string) {
  const originalRegisterTool = server.registerTool.bind(server);

  // Override registerTool to wrap handlers with auth check
  server.registerTool = function(name: string, config: any, handler: any) {
    const wrappedHandler = async (params: any) => {
      // List of tools that require authentication
      const authRequiredTools = ['searchMemories', 'storeMemory', 'getMemory'];
      
      if (authRequiredTools.includes(name) && !userId) {
        // Throw an authentication error
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const error = new Error('Authentication required');
        (error as any).code = -32001;
        (error as any).data = {
          type: 'oauth_required',
          error: 'unauthorized',
          error_description: 'This operation requires authentication',
          resource_server: baseUrl,
          resource_metadata: `${baseUrl}/.well-known/oauth-protected-resource`,
          www_authenticate: `Bearer realm="${baseUrl}", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
        };
        throw error;
      }

      // Call original handler
      try {
        return await handler(params);
      } catch (error) {
        logger.error(`Error in tool ${name}:`, error);
        throw error;
      }
    };

    return originalRegisterTool(name, config, wrappedHandler);
  };

  return server;
}