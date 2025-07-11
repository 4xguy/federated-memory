# Railway Deployment Guide

This guide walks through deploying the Federated Memory MCP server and its frontend to Railway.

## Prerequisites

1. Railway account with a project created
2. PostgreSQL database provisioned in Railway
3. GitHub repository connected

## Architecture

The system consists of two separate Railway services:
1. **Backend MCP Server** - Main federated memory API
2. **Frontend** - Next.js OAuth registration/login interface

## Backend Deployment

### 1. Create Backend Service

1. In Railway dashboard, click "New Service"
2. Select "Deploy from GitHub repo"
3. Choose your repository
4. Railway will auto-detect the Dockerfile

### 2. Configure Environment Variables

Add these variables in the Railway service settings:

```bash
# Database (Railway provides DATABASE_URL automatically)
DATABASE_URL=postgresql://...  # Auto-populated by Railway

# Authentication
JWT_SECRET=<generate-secure-secret>
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=sk-...

# OAuth (for MCP compatibility)
OAUTH_CLIENT_ID=federated-memory-mcp
OAUTH_CLIENT_SECRET=<generate-secure-secret>
OAUTH_REDIRECT_BASE_URL=https://<your-backend>.railway.app

# Redis (optional)
REDIS_URL=redis://...

# Server
PORT=3000
NODE_ENV=production
```

### 3. Database Setup

The backend uses `npm run start:railway` which automatically:
1. Runs Prisma migrations
2. Creates pgvector extension
3. Initializes database schema

No manual database setup required!

### 4. Verify Deployment

1. Check build logs in Railway
2. Visit `/api/health` endpoint
3. Test MCP endpoints at `/mcp/`

## Frontend Deployment

### 1. Create Frontend Service

1. Click "New Service" in same Railway project
2. Deploy from same GitHub repo
3. Set root directory to `/frontend`
4. Railway will detect the Dockerfile

### 2. Configure Environment Variables

```bash
# API Connection
NEXT_PUBLIC_API_URL=https://<your-backend>.railway.app

# OAuth Configuration
NEXT_PUBLIC_OAUTH_CLIENT_ID=federated-memory-mcp
NEXTAUTH_URL=https://<your-frontend>.railway.app
NEXTAUTH_SECRET=<generate-secure-secret>

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

### 3. Domain Setup

1. Go to service Settings → Networking
2. Click "Generate Domain" for public access
3. Or add custom domain

## MCP Client Configuration

### Claude Desktop

Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "federated-memory": {
      "url": "https://<your-backend>.railway.app/mcp",
      "transport": {
        "type": "http"
      },
      "auth": {
        "type": "oauth",
        "clientId": "federated-memory-mcp",
        "authorizeUrl": "https://<your-frontend>.railway.app/api/auth/authorize",
        "tokenUrl": "https://<your-backend>.railway.app/api/auth/token",
        "scope": "memory:read memory:write"
      }
    }
  }
}
```

### Direct API Access

For API key authentication:

```bash
curl -H "Authorization: Bearer <api-key>" \
  https://<your-backend>.railway.app/api/memories
```

## Monitoring

### Health Checks

- Backend: `GET /api/health`
- Frontend: `GET /`

### Logs

View logs in Railway dashboard or CLI:
```bash
railway logs -s backend
railway logs -s frontend
```

## Troubleshooting

### Common Issues

1. **"Module not found" errors**
   - Ensure `module-alias` is properly configured
   - Check TypeScript build output structure

2. **Database connection failures**
   - Verify DATABASE_URL is set
   - Check pgvector extension is installed
   - Ensure migrations have run

3. **OAuth redirect issues**
   - Verify OAUTH_REDIRECT_BASE_URL matches actual URL
   - Check frontend NEXTAUTH_URL configuration

4. **Build failures**
   - Check Node.js version (requires >= 20.0.0)
   - Verify all dependencies in package.json
   - Review Dockerfile stages

### Debug Commands

Run locally with Railway environment:
```bash
railway run npm run dev
```

Test database connection:
```bash
railway run npx prisma db push
```

## Security Notes

1. Always use HTTPS in production
2. Set strong JWT_SECRET and NEXTAUTH_SECRET
3. Configure CORS appropriately
4. Use environment variables for all secrets
5. Enable rate limiting in production

## Scaling

Railway supports:
- Horizontal scaling (increase replicas)
- Vertical scaling (adjust resources)
- Auto-scaling based on CPU/memory

Configure in service settings or railway.json.