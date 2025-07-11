# OAuth Provider Setup Guide

This guide walks through setting up Google and GitHub OAuth for the Federated Memory frontend.

## Prerequisites

- Frontend deployed on Railway with a public URL
- Backend API deployed and accessible

## Environment Variables Required

Set these in your Railway frontend service:

```bash
# NextAuth Configuration
NEXTAUTH_URL=https://your-frontend.railway.app
NEXTAUTH_SECRET=<generate-secure-32-char-secret>

# OAuth Providers
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>
GITHUB_CLIENT_ID=<from-github-settings>
GITHUB_CLIENT_SECRET=<from-github-settings>

# Backend Connection
BACKEND_URL=https://your-backend.railway.app
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add Authorized redirect URIs:
   ```
   https://your-frontend.railway.app/api/auth/callback/google
   ```
7. Copy Client ID and Client Secret

## GitHub OAuth Setup

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - Application name: Federated Memory
   - Homepage URL: `https://your-frontend.railway.app`
   - Authorization callback URL: `https://your-frontend.railway.app/api/auth/callback/github`
4. Copy Client ID and generate Client Secret

## Generate NEXTAUTH_SECRET

Run this command to generate a secure secret:
```bash
openssl rand -base64 32
```

## Testing OAuth

1. Visit `https://your-frontend.railway.app/login`
2. Click on Google or GitHub button
3. Should redirect to provider login
4. After authorization, redirects back to your app

## Troubleshooting

### "Redirect URI mismatch" error
- Ensure the callback URL in provider settings matches exactly
- Include the protocol (https://)
- No trailing slashes

### 404 on callback
- Check NEXTAUTH_URL is set correctly
- Verify the frontend has deployed with latest changes
- Check Railway logs for errors

### Session not persisting
- Verify NEXTAUTH_SECRET is set
- Check cookies are being set (secure flag requires HTTPS)

## Security Notes

1. Always use HTTPS in production
2. Keep OAuth secrets secure
3. Rotate NEXTAUTH_SECRET periodically
4. Limit OAuth app permissions to minimum required