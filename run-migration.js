const { PrismaClient } = require('@prisma/client');

async function runMigration() {
  console.log('Running production database migration...\n');
  
  const prisma = new PrismaClient({
    log: ['info', 'warn', 'error'],
  });

  try {
    // Add missing columns
    console.log('1. Adding missing columns...');
    await prisma.$executeRaw`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT,
      ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'
    `;
    console.log('✅ Columns added successfully');

    // Create unique index
    console.log('\n2. Creating unique index...');
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "users_emailVerificationToken_key" 
      ON users("emailVerificationToken")
    `;
    console.log('✅ Index created successfully');

    // Update existing users
    console.log('\n3. Updating existing users...');
    const updateCount = await prisma.$executeRaw`
      UPDATE users 
      SET "emailVerified" = true 
      WHERE "emailVerified" IS NULL
    `;
    console.log(`✅ Updated ${updateCount} users to be verified`);

    // Verify the schema
    console.log('\n4. Verifying schema...');
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `;
    
    console.log('\nUpdated users table schema:');
    console.log('---------------------------');
    columns.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type}`);
    });

    // Test the fix
    console.log('\n5. Testing login query...');
    const testUser = await prisma.user.findUnique({
      where: { email: 'keithrivas@gmail.com' },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        isActive: true,
      }
    });
    
    if (testUser) {
      console.log('\n✅ Login query works!');
      console.log('User:', testUser.email);
      console.log('Email verified:', testUser.emailVerified);
      console.log('Active:', testUser.isActive);
    }

  } catch (error) {
    console.error('Migration error:', error.message);
    console.error('Error code:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration().catch(console.error);