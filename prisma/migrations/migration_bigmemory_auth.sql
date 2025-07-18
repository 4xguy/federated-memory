-- Migration to BigMemory authentication pattern

-- 1. Update User table
-- Make email optional
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Add email verification field
ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- Add metadata JSON field
ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

-- Ensure token has default UUID generation
ALTER TABLE users ALTER COLUMN token SET DEFAULT gen_random_uuid();

-- Add index on token for performance
CREATE INDEX IF NOT EXISTS "users_token_idx" ON users(token);

-- 2. Create Session table for SSE tracking
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL UNIQUE,
    "connectionType" TEXT NOT NULL,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add indexes for Session table
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON sessions("userId");
CREATE INDEX IF NOT EXISTS "sessions_connectionId_idx" ON sessions("connectionId");

-- 3. Generate UUID tokens for existing users who don't have them
UPDATE users 
SET token = gen_random_uuid()::text 
WHERE token IS NULL OR token = '' OR token NOT SIMILAR TO '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

-- 4. Note: ApiKey table will be kept for now but marked as deprecated
-- Add comment to indicate deprecation
COMMENT ON TABLE api_keys IS 'DEPRECATED - To be removed after migration to UUID tokens';