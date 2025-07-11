# Railway Database Fix Instructions

## Problem
The storage operations are failing because:
1. The database queries use dynamic table names with Prisma's template literals, which causes syntax errors
2. The pgvector extension might not be properly initialized
3. Tables might be missing or not properly migrated

## Solution Applied
1. Updated `/src/utils/database.ts` to use `$queryRawUnsafe` and `$executeRawUnsafe` with proper parameterized queries instead of template literals for dynamic table names.

## Steps to Fix on Railway

### 1. Set Environment Variables
Make sure these are set in Railway:
```
DATABASE_URL=<your-railway-postgres-url>
BASE_URL=https://federated-memory-production.up.railway.app
```

### 2. Connect to Railway Database
Use Railway's database dashboard or connect via psql:
```bash
# Get connection string from Railway dashboard
psql $DATABASE_URL
```

### 3. Initialize pgvector Extension
Run this SQL command:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. Verify Tables Exist
Check if all memory tables exist:
```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE '%memor%';
```

You should see:
- memory_index
- memory_relationships  
- technical_memories
- personal_memories
- work_memories
- learning_memories
- communication_memories
- creative_memories

### 5. Run Migrations (if tables missing)
In Railway, you can:
- Use the Railway CLI: `railway run npm run db:migrate:deploy`
- Or add a deploy command in Railway settings: `npm run db:migrate:deploy && npm run start:prod`

### 6. Verify Database Setup
After deployment, you can verify the database is properly set up:
```bash
railway run npm run db:verify
```

### 7. Test Storage Again
Try the storage operations again from Claude.ai. They should now work properly.

## Alternative: Reset and Reinitialize
If issues persist, you can reset the database:

1. Backup any important data
2. Run: `railway run npm run db:reset`
3. Run: `railway run npm run db:migrate`
4. Run: `railway run npm run db:init`

## Monitoring
Check Railway logs for any database connection errors:
```bash
railway logs
```

Look for:
- "Database connection successful"
- "pgvector extension created"
- Any PostgreSQL syntax errors