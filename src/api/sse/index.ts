import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AuthService } from '@/services/auth.service';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/database';

// Connection tracking
export const activeConnections = new Map<string, SSEConnection>();

export interface SSEConnection {
  userId: string;
  response: Response;
  lastActivity: number;
  heartbeatInterval: NodeJS.Timeout;
}

const authService = AuthService.getInstance();

/**
 * SSE endpoint handler following BigMemory pattern
 * Single endpoint that serves all users with token-based authentication
 */
export async function handleSSE(req: Request, res: Response) {
  try {
    // Get token from URL path (BigMemory pattern)
    const token = req.params.token;
    
    console.log('SSE handler called with params:', req.params);
    console.log('Token from params:', token);
    
    if (!token) {
      return res.status(401).json({
        error: 'No authentication token provided',
        code: 'NO_TOKEN'
      });
    }
    
    // Validate token
    const authResult = await authService.validateToken(token);
    if (!authResult) {
      // Don't leak information about invalid tokens (BigMemory pattern)
      return res.status(404).end();
    }
    
    const userId = authResult.userId;
    
    // Set SSE headers - CRITICAL for proper operation
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
      'Access-Control-Allow-Origin': '*', // Adjust for security
    });
    
    // Generate connection ID
    const connectionId = randomUUID();
    
    // Send initial connection confirmation
    sendSSEMessage(res, {
      type: 'connection',
      connectionId,
      userId
    });
    
    // Send MCP capabilities
    sendSSEMessage(res, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {
        protocolVersion: '2024-11-05',
        serverName: 'federated-memory',
        capabilities: {
          tools: await getToolsForUser(userId),
          resources: await getResourcesForUser(userId),
          prompts: true,
          sampling: false
        }
      }
    });
    
    // Heartbeat to prevent timeout (every 30 seconds)
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(':ping\n\n');
      } catch (error) {
        // Connection closed, cleanup will handle
      }
    }, 30000);
    
    // Store connection
    activeConnections.set(connectionId, {
      userId,
      response: res,
      lastActivity: Date.now(),
      heartbeatInterval
    });
    
    // Store in database for tracking
    await prisma.session.create({
      data: {
        userId,
        connectionId,
        connectionType: 'sse',
        metadata: {
          userAgent: req.headers['user-agent'],
          origin: req.headers.origin,
          startTime: new Date().toISOString()
        }
      }
    }).catch(err => logger.error('Failed to create session record', err));
    
    logger.info('SSE connection established', { userId, connectionId });
    
    // CRITICAL: Cleanup on disconnect
    req.on('close', async () => {
      clearInterval(heartbeatInterval);
      activeConnections.delete(connectionId);
      
      // Update session record
      await prisma.session.delete({
        where: { connectionId }
      }).catch(err => logger.error('Failed to delete session record', err));
      
      logger.info(`SSE connection closed for user ${userId}`);
    });
    
    // Handle connection errors
    req.on('error', async (error) => {
      logger.error(`SSE connection error for user ${userId}:`, error);
      clearInterval(heartbeatInterval);
      activeConnections.delete(connectionId);
      
      await prisma.session.delete({
        where: { connectionId }
      }).catch(err => logger.error('Failed to delete session record', err));
    });
    
  } catch (error) {
    logger.error('SSE handler error', { error });
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to establish SSE connection',
        code: 'SSE_ERROR'
      });
    }
  }
}

/**
 * Helper function to send SSE messages
 */
export function sendSSEMessage(res: Response, data: any) {
  try {
    // SSE format: "data: <json>\n\n"
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    // Force send if available
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
  } catch (error) {
    logger.error('Failed to send SSE message:', error);
  }
}

/**
 * Broadcast to specific user (used by other parts of the system)
 */
export function broadcastToUser(userId: string, message: any) {
  for (const [connId, conn] of activeConnections.entries()) {
    if (conn.userId === userId) {
      sendSSEMessage(conn.response, message);
      conn.lastActivity = Date.now();
    }
  }
}

/**
 * Get tools available for a user
 */
async function getToolsForUser(userId: string) {
  // Return tools based on user permissions
  return [
    {
      name: 'memory/search',
      description: 'Search across federated memory modules',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          modules: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Modules to search (optional)'
          },
          limit: { type: 'number', description: 'Maximum results', default: 10 }
        },
        required: ['query']
      }
    },
    {
      name: 'memory/store',
      description: 'Store a memory in the appropriate module',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Memory content' },
          metadata: { type: 'object', description: 'Additional metadata' }
        },
        required: ['content']
      }
    },
    {
      name: 'memory/retrieve',
      description: 'Retrieve a specific memory by ID',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Memory ID' },
          moduleId: { type: 'string', description: 'Module ID' }
        },
        required: ['id', 'moduleId']
      }
    }
  ];
}

/**
 * Get resources available for a user
 */
async function getResourcesForUser(userId: string) {
  // Get user's memory statistics
  const stats = await prisma.memoryIndex.groupBy({
    by: ['moduleId'],
    where: { userId },
    _count: true
  });
  
  return stats.map(stat => ({
    uri: `memory://${stat.moduleId}`,
    name: `${stat.moduleId} memories`,
    description: `Access ${stat._count} memories in ${stat.moduleId} module`,
    mimeType: 'application/json'
  }));
}

// Periodic cleanup of stale connections
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes
  
  for (const [connId, conn] of activeConnections.entries()) {
    if (now - conn.lastActivity > timeout) {
      try {
        conn.response.end();
      } catch (e) {
        // Already closed
      }
      clearInterval(conn.heartbeatInterval);
      activeConnections.delete(connId);
      
      // Clean up database record
      prisma.session.delete({
        where: { connectionId: connId }
      }).catch(err => logger.error('Failed to clean up stale session', err));
    }
  }
}, 60000); // Check every minute

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Shutting down SSE connections...');
  
  // Close all SSE connections
  for (const [connId, conn] of activeConnections.entries()) {
    sendSSEMessage(conn.response, {
      type: 'server_shutdown',
      message: 'Server is shutting down'
    });
    conn.response.end();
    clearInterval(conn.heartbeatInterval);
  }
  activeConnections.clear();
});