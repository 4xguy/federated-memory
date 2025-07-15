import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';

console.log('Starting minimal health server with database...');
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'not set',
});

const prisma = new PrismaClient({
  log: ['error', 'warn'],
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

// Start server with database connection
async function start() {
  try {
    // Try to connect to database
    console.log('Attempting database connection...');
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    console.log('Continuing without database...');
  }

  server.listen(port, () => {
    console.log(`Minimal server listening on port ${port}`);
    console.log(`Health check available at http://localhost:${port}/api/health`);
  });
}

start().catch(console.error);

// Keep process alive
process.on('SIGTERM', async () => {
  console.log('SIGTERM received');
  server.close(async () => {
    console.log('Server closed');
    await prisma.$disconnect();
    console.log('Database disconnected');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});