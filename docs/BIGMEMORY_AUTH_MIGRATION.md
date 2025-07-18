# BigMemory Authentication Migration Guide

## Overview

This guide documents the migration from the previous JWT/API key authentication system to the BigMemory-style UUID token authentication pattern.

## What Changed

### Previous System
- **JWT tokens** for web sessions (7-day expiry)
- **API keys** for MCP/programmatic access
- **OAuth 2.0** provider functionality
- Complex token management with expiration

### New System (BigMemory Pattern)
- **UUID tokens** for all authentication (no expiry)
- **OAuth** only for Google/GitHub login (consumer only)
- **Single SSE endpoint** at `/api/mcp/sse`
- Simplified authentication flow

## Migration Steps

### 1. Database Migration

Run the migration to update your database schema:

```bash
# Apply the migration
psql $DATABASE_URL < prisma/migrations/migration_bigmemory_auth.sql

# Generate Prisma client
npm run db:generate

# Optional: Run full migration
npm run db:migrate
```

### 2. Environment Variables

Update your `.env` file:
- `JWT_SECRET` - No longer required for auth (kept for OAuth provider if needed)
- `SESSION_SECRET` - Still required for session management
- All other variables remain the same

### 3. API Changes

#### Registration
```bash
# New user registration
POST /api/auth/register
{
  "email": "user@example.com" // optional
}

# Response
{
  "success": true,
  "data": {
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-id"
  }
}

# CLI-friendly registration (no email)
POST /api/auth/register-cli
# Response: { "token": "550e8400-e29b-41d4-a716-446655440000" }
```

#### Authentication
All requests now use UUID tokens:
```bash
# Header authentication
Authorization: Bearer 550e8400-e29b-41d4-a716-446655440000

# Query parameter (for SSE)
GET /api/mcp/sse?token=550e8400-e29b-41d4-a716-446655440000
```

#### Token Rotation
```bash
POST /api/auth/rotate
Authorization: Bearer <current-token>

# Response
{
  "success": true,
  "data": {
    "token": "new-uuid-token"
  }
}
```

### 4. SSE Connection

The new SSE endpoint follows BigMemory pattern:

```javascript
// Connect to SSE
const eventSource = new EventSource('/api/mcp/sse?token=your-uuid-token');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### 5. MCP Client Configuration

Update your MCP client configuration:

```json
{
  "mcpServers": {
    "federated-memory": {
      "command": "node",
      "args": ["path/to/mcp-client.js"],
      "env": {
        "MCP_TOKEN": "your-uuid-token",
        "MCP_BASE_URL": "https://your-server.com"
      }
    }
  }
}
```

### 6. OAuth Flow (Google/GitHub)

OAuth login still works but now returns UUID tokens:

1. User clicks "Login with Google/GitHub"
2. OAuth flow completes
3. User is redirected with UUID token (not JWT)
4. Frontend stores UUID token for API access

## Breaking Changes

1. **API Keys Deprecated**: The `/api/keys` endpoints are deprecated. Use UUID tokens instead.
2. **JWT Tokens Invalid**: Previous JWT tokens will not work. Users need new UUID tokens.
3. **Session Format**: Session tokens are now UUIDs, not JWTs.

## Data Migration

For existing users with API keys:

```sql
-- View users who need migration
SELECT id, email, token FROM users WHERE token IS NULL OR token = '';

-- Migration is automatic on first login via OAuth
-- Or manually generate tokens for existing users
UPDATE users SET token = gen_random_uuid()::text WHERE token IS NULL;
```

## Security Considerations

1. **Token Storage**: UUID tokens don't expire - store them securely
2. **Token Rotation**: Implement regular token rotation for sensitive environments
3. **HTTPS Required**: Always use HTTPS in production
4. **Rate Limiting**: Implement per-user rate limiting

## Rollback Plan

If you need to rollback:

1. Keep the old auth middleware temporarily
2. Support both JWT and UUID tokens during transition
3. Gradually migrate users to UUID tokens
4. Remove JWT support after all users migrated

## Testing

Test the new authentication:

```bash
# 1. Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# 2. Use the token
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_UUID_TOKEN"

# 3. Test SSE connection
curl http://localhost:3000/api/mcp/sse?token=YOUR_UUID_TOKEN
```

## Support

For issues or questions:
- Check server logs for authentication errors
- Verify token format (must be valid UUID v4)
- Ensure database migrations completed successfully
- Test with the `/api/auth/validate` endpoint