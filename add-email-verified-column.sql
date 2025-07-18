-- Add missing email verification columns to match Prisma schema
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT,
ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}';

-- Create unique index on emailVerificationToken if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS "users_emailVerificationToken_key" ON users("emailVerificationToken");

-- Update existing users to be verified (since they're already active)
UPDATE users SET "emailVerified" = true WHERE "emailVerified" IS NULL;

-- Show the updated schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;