# Federated Memory Frontend

A separate Next.js application for user authentication and MCP server management.

## Architecture

This frontend is designed to be deployed as a separate Railway service that:
1. Handles Google/GitHub OAuth authentication
2. Manages user sessions
3. Provides OAuth consent screens for MCP clients
4. Allows users to generate and manage API keys
5. Shows memory usage statistics

## Deployment

This service communicates with the main MCP server via:
- Internal Railway network for backend API calls
- Public OAuth endpoints for Claude product authentication

## Environment Variables

```env
# OAuth Providers
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Backend API
BACKEND_URL=http://federated-memory.railway.internal:3000
PUBLIC_BACKEND_URL=https://federated-memory.up.railway.app

# Session
SESSION_SECRET=

# Database (shared with backend)
DATABASE_URL=
```

## Routes

- `/` - Landing page
- `/login` - OAuth login selection
- `/dashboard` - User dashboard
- `/oauth/consent` - OAuth consent screen for MCP clients
- `/api-keys` - Manage API keys for direct MCP access
- `/settings` - User settings