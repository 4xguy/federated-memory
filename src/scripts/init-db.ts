import { PrismaClient } from '@prisma/client';
import { logger } from '@utils/logger';

const prisma = new PrismaClient();

async function initDatabase() {
  try {
    logger.info('Initializing database...');

    // Check if pgvector extension exists
    const extensions = await prisma.$queryRaw`
      SELECT * FROM pg_extension WHERE extname = 'vector'
    `;

    if (!Array.isArray(extensions) || extensions.length === 0) {
      logger.info('Creating pgvector extension...');
      await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
      logger.info('pgvector extension created');
    } else {
      logger.info('pgvector extension already exists');
    }

    // Verify database connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection verified');

    // Check if tables exist
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('User', 'Memory', 'TechnicalMemory', 'PersonalMemory', 'WorkMemory', 'LearningMemory', 'CommunicationMemory', 'CreativeMemory')
    `;

    logger.info(`Found ${Array.isArray(tables) ? tables.length : 0} tables`);
  } catch (error) {
    logger.error('Database initialization failed:', error);
    // Don't throw error to allow Railway deployment to continue
  } finally {
    await prisma.$disconnect();
  }
}

initDatabase();
