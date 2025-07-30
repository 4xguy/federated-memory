# Database Configuration Guide

## Environment Variables

### Local Development (.env.local)
- `PRODUCTION_DATABASE_URL` - Connection string to production database (Railway)
- `LOCAL_DATABASE_URL` - Connection string to local PostgreSQL instance (optional)
- `DATABASE_URL` - Fallback, but prefer using the specific URLs above

### Production (Railway.com)
- `DATABASE_URL` - Set automatically by Railway, points to production database
- Do NOT set `PRODUCTION_DATABASE_URL` or `LOCAL_DATABASE_URL` in production

## How It Works

The application automatically selects the correct database based on the environment:

1. **In Production (Railway)**:
   - Uses `DATABASE_URL` (set by Railway)
   - This ensures production always uses its own database

2. **In Local Development**:
   - By default uses `PRODUCTION_DATABASE_URL` if set
   - This allows you to develop against production data
   - To use local database, either:
     - Remove `PRODUCTION_DATABASE_URL` from .env.local
     - Or use scripts with `--local` flag

3. **For Scripts**:
   - Scripts can override using `getDatabaseUrl({ useLocal: true })`
   - Or `getDatabaseUrl({ useProduction: true })`

## Redis Configuration

- `REDIS_URL` - Connection string to Redis instance
- In your case, this is set to production Redis in .env.local
- Redis is optional - the app works without it

## Migration Commands

```bash
# Run migrations against production (from local)
npm run db:migrate

# Run migrations against local database
DATABASE_URL=$LOCAL_DATABASE_URL npm run db:migrate
```

## Important Notes

1. **Railway Environment**: Keep only `DATABASE_URL` in Railway environment variables
2. **Security**: Never commit .env.local with production credentials
3. **Development**: Using production database locally helps ensure consistency
4. **Testing**: Use `LOCAL_DATABASE_URL` when you need isolated testing