import 'dotenv/config';
import { prisma } from '../src/utils/database';
import { logger } from '../src/utils/logger';

async function setupTestDatabase() {
  logger.info('Setting up test database...');

  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✓ Database connection successful');

    // Check if pgvector extension exists
    const extensions = await prisma.$queryRaw`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    
    if (!extensions || (extensions as any[]).length === 0) {
      logger.error('❌ pgvector extension not found. Please install it:');
      logger.error('   CREATE EXTENSION IF NOT EXISTS vector;');
      process.exit(1);
    }
    
    logger.info('✓ pgvector extension found');

    // Check if tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('memory_index', 'memory_modules', 'technical_memories')
    `;

    logger.info(`✓ Found ${(tables as any[]).length} required tables`);

    if ((tables as any[]).length < 3) {
      logger.warn('⚠️  Some tables are missing. Run migrations:');
      logger.warn('   npm run db:migrate');
    }

    // Create a test user if needed
    const testUserId = 'test-user-123';
    const existingUser = await prisma.user.findUnique({
      where: { id: testUserId }
    });

    if (!existingUser) {
      await prisma.user.create({
        data: {
          id: testUserId,
          email: 'test@example.com',
          token: 'test-token-123'
        }
      });
      logger.info('✓ Created test user');
    } else {
      logger.info('✓ Test user already exists');
    }

    // Initialize memory modules table
    const technicalModuleExists = await prisma.memoryModule.findUnique({
      where: { moduleId: 'technical' }
    });

    if (!technicalModuleExists) {
      await prisma.memoryModule.create({
        data: {
          moduleId: 'technical',
          moduleName: 'Technical Memory',
          description: 'Stores programming knowledge, debugging information, and technical documentation',
          moduleType: 'specialized',
          configuration: {
            features: {
              codeExtraction: true,
              errorPatternMatching: true,
              frameworkDetection: true
            }
          },
          isActive: true
        }
      });
      logger.info('✓ Initialized technical module in database');
    } else {
      logger.info('✓ Technical module already registered');
    }

    logger.info('\n✅ Database setup complete!');
    logger.info('You can now run: npm run test:module');

  } catch (error) {
    logger.error('Database setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestDatabase();