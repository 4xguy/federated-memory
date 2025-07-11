import 'dotenv/config';
import { BigMemoryMigrator } from './migrate-bigmemory-sql';

async function testMigration() {
  const config = {
    sourceDatabaseUrl: process.env.SOURCE_DATABASE_URL || '',
    targetDatabaseUrl: process.env.DATABASE_URL || '',
    batchSize: 5, // Small batch for testing
    preserveEmbeddings: true,
    dryRun: true
  };

  console.log('Testing migration with 5 memories...\n');
  
  const migrator = new BigMemoryMigrator(config);
  
  try {
    await migrator.initialize();
    const stats = await migrator.migrate();
    migrator.printReport();
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testMigration();