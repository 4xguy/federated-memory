# Database Connection Management

## Overview

This document describes how to monitor and manage PostgreSQL connections for the Federated Memory system.

## Connection Pool Configuration

The application uses a singleton PrismaClient with connection pooling:

```typescript
// Connection limits set via URL parameters
connection_limit=20    // Maximum 20 connections
pool_timeout=30        // 30 second timeout for idle connections
```

## Monitoring Connections

### 1. Health Check Endpoint

The `/api/health/detailed` endpoint now includes connection statistics:

```bash
curl https://your-app.railway.app/api/health/detailed
```

Response includes:
```json
{
  "checks": {
    "database": {
      "status": "ok",
      "connections": {
        "total": 15,
        "active": 3,
        "idle": 12,
        "max": 100,
        "usage": "15.0%"
      }
    }
  }
}
```

### 2. Check Connections Script

Run locally to inspect production connections:

```bash
# Check current connections
node scripts/check-db-connections.js

# Terminate idle connections > 30 minutes
node scripts/check-db-connections.js --terminate
```

### 3. Emergency Cleanup

If experiencing "too many clients" errors:

```bash
# Normal cleanup (idle > 5 minutes)
node scripts/cleanup-production-connections.js

# Aggressive cleanup (ALL idle connections)
node scripts/cleanup-production-connections.js --aggressive
```

## Common Issues and Solutions

### "Too many clients already" Error

**Symptoms:**
- Application fails to start
- Health checks fail
- Database queries timeout

**Solutions:**

1. **Immediate Fix - Clear idle connections:**
   ```sql
   -- Terminate connections idle > 10 minutes
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE datname = current_database()
     AND state = 'idle'
     AND state_change < NOW() - INTERVAL '10 minutes';
   ```

2. **Check for connection leaks:**
   ```sql
   -- Find applications with many connections
   SELECT application_name, count(*)
   FROM pg_stat_activity
   WHERE datname = current_database()
   GROUP BY application_name
   ORDER BY count DESC;
   ```

3. **Monitor connection usage:**
   ```sql
   -- Get connection statistics
   SELECT 
     COUNT(*) as total,
     COUNT(*) FILTER (WHERE state = 'active') as active,
     COUNT(*) FILTER (WHERE state = 'idle') as idle,
     (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max
   FROM pg_stat_activity
   WHERE datname = current_database();
   ```

### Best Practices

1. **Use Connection Pooling:**
   - Always use the shared `prisma` instance from `utils/database.ts`
   - Never create new PrismaClient instances

2. **Set Appropriate Limits:**
   - Production: 20-30 connections (for 100 total limit)
   - Development: 5-10 connections
   - Leave headroom for migrations and admin access

3. **Monitor Regularly:**
   - Check `/api/health/detailed` endpoint
   - Set up alerts for > 80% connection usage
   - Review connection patterns weekly

4. **Handle Graceful Shutdown:**
   - Always disconnect on process termination
   - Implement proper cleanup in all services

## Railway-Specific Configuration

Railway PostgreSQL instances typically have:
- 100 total connections available
- Shared across all services and addons
- No ability to increase via dashboard

Recommendations:
- Use max 20-30% of available connections
- Monitor via Railway metrics dashboard
- Consider connection pooling services for scale

## Troubleshooting Commands

```bash
# Connect to production database
psql $DATABASE_URL

# Show all connections
\x on
SELECT * FROM pg_stat_activity WHERE datname = current_database();

# Kill a specific connection
SELECT pg_terminate_backend(PID_HERE);

# Kill all idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state = 'idle';
```

## Prevention

1. **Code Reviews:** Check for connection leaks
2. **Testing:** Load test connection usage
3. **Monitoring:** Set up alerts for high usage
4. **Documentation:** Keep this guide updated

## Emergency Contacts

If database is completely locked:
1. Use Railway dashboard to restart service
2. Run emergency cleanup script
3. Check for runaway processes
4. Consider scaling database if persistent