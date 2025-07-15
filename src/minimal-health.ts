import express from 'express';
import { createServer } from 'http';

console.log('Starting minimal health server...');
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'not set',
});

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

// Health checks
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'federated-memory-minimal' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'federated-memory-minimal' });
});

app.get('/', (_req, res) => {
  res.json({ message: 'Minimal server running', health: '/api/health' });
});

// Start server
server.listen(port, () => {
  console.log(`Minimal server listening on port ${port}`);
  console.log(`Health check available at http://localhost:${port}/api/health`);
});

// Keep process alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});