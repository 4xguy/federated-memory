const { PrismaClient } = require('@prisma/client');

async function checkSchema() {
  console.log('Checking production database schema...\n');
  
  const prisma = new PrismaClient({
    log: ['error'],
  });

  try {
    // Try to query the users table structure
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `;
    
    console.log('Users table columns:');
    console.log('-------------------');
    result.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema().catch(console.error);