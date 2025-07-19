import { Client } from 'pg';
import { logger } from '@/utils/logger';
import { broadcastToUser } from '@/api/sse';

interface RealtimeMessage {
  userId: string;
  type: 'project_created' | 'project_updated' | 'project_deleted' | 
        'task_created' | 'task_updated' | 'task_deleted' |
        'memory_created' | 'memory_updated' | 'memory_deleted';
  data: any;
  timestamp: Date;
}

class RealtimeService {
  private static instance: RealtimeService;
  private pgClient: Client | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  private constructor() {}

  static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  async initialize(): Promise<void> {
    await this.connect();
    await this.setupListeners();
    logger.info('RealtimeService initialized');
  }

  private async connect(): Promise<void> {
    try {
      if (this.pgClient) {
        await this.pgClient.end();
      }

      this.pgClient = new Client({
        connectionString: process.env.DATABASE_URL
      });

      await this.pgClient.connect();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Handle connection errors
      this.pgClient.on('error', (err) => {
        logger.error('PostgreSQL connection error:', err);
        this.isConnected = false;
        this.reconnect();
      });

      logger.info('PostgreSQL LISTEN/NOTIFY client connected');
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL:', error);
      this.isConnected = false;
      this.reconnect();
    }
  }

  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private async setupListeners(): Promise<void> {
    if (!this.pgClient || !this.isConnected) {
      throw new Error('PostgreSQL client not connected');
    }

    // Listen for memory changes
    await this.pgClient.query('LISTEN memory_changes');
    await this.pgClient.query('LISTEN project_changes');
    await this.pgClient.query('LISTEN task_changes');

    this.pgClient.on('notification', (msg) => {
      try {
        if (msg.payload) {
          const data: RealtimeMessage = JSON.parse(msg.payload);
          this.handleRealtimeMessage(data);
        }
      } catch (error) {
        logger.error('Failed to parse notification payload:', error);
      }
    });
  }

  private handleRealtimeMessage(message: RealtimeMessage): void {
    try {
      logger.debug('Received realtime message:', message);
      
      // Broadcast to user's SSE connections
      broadcastToUser(message.userId, {
        type: 'realtime_update',
        event: message.type,
        data: message.data,
        timestamp: message.timestamp
      });
      
      // Could also broadcast to specific channels or rooms if needed
      // this.broadcastToRoom(message.userId, message);
      
    } catch (error) {
      logger.error('Failed to handle realtime message:', error);
    }
  }

  // Methods to trigger notifications from the application
  async notifyProjectChange(userId: string, type: 'created' | 'updated' | 'deleted', projectData: any): Promise<void> {
    await this.notify('project_changes', {
      userId,
      type: `project_${type}`,
      data: projectData,
      timestamp: new Date()
    });
  }

  async notifyTaskChange(userId: string, type: 'created' | 'updated' | 'deleted', taskData: any): Promise<void> {
    await this.notify('task_changes', {
      userId,
      type: `task_${type}`,
      data: taskData,
      timestamp: new Date()
    });
  }

  async notifyMemoryChange(userId: string, type: 'created' | 'updated' | 'deleted', memoryData: any): Promise<void> {
    await this.notify('memory_changes', {
      userId,
      type: `memory_${type}`,
      data: memoryData,
      timestamp: new Date()
    });
  }

  private async notify(channel: string, message: RealtimeMessage): Promise<void> {
    if (!this.pgClient || !this.isConnected) {
      logger.warn('Cannot send notification - PostgreSQL client not connected');
      return;
    }

    try {
      await this.pgClient.query('SELECT pg_notify($1, $2)', [
        channel,
        JSON.stringify(message)
      ]);
    } catch (error) {
      logger.error('Failed to send notification:', error);
    }
  }

  async shutdown(): Promise<void> {
    if (this.pgClient) {
      await this.pgClient.end();
      this.pgClient = null;
    }
    this.isConnected = false;
    logger.info('RealtimeService shutdown');
  }
}

export default RealtimeService;