import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';

async function main() {
  try {
    console.log('Starting Ultra-Minimal Federated Memory Server...');
    
    const app = express();
    const server = createServer(app);
    const port = process.env.PORT || 3000;

    // Health check endpoint
    app.get('/api/health', (_req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'federated-memory-ultra-minimal',
      });
    });

    // Also add root health check
    app.get('/health', (_req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'federated-memory-ultra-minimal',
      });
    });

    // Root endpoint
    app.get('/', (_req, res) => {
      res.status(200).json({
        message: 'Ultra-Minimal Federated Memory Server',
        health: '/api/health',
        version: '1.0.0',
      });
    });

    // Start server
    server.listen(port, () => {
      console.log(`Ultra-Minimal server running on port ${port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('HTTP server closed');
      });
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});