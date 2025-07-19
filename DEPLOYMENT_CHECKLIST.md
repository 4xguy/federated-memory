# Production Deployment Checklist

## Pre-deployment

### Environment Configuration
- [ ] Set `NODE_ENV=production`
- [ ] Configure `DATABASE_URL` with production database
- [ ] Set `OPENAI_API_KEY` securely
- [ ] Configure `JWT_SECRET` (use strong random value)
- [ ] Set `NEXTAUTH_URL` to production domain
- [ ] Configure `NEXTAUTH_SECRET`
- [ ] Update `NEXT_PUBLIC_API_URL` in frontend

### Database
- [ ] Run database migrations: `npm run db:migrate:deploy`
- [ ] Verify pgvector extension is installed
- [ ] Set up database backups
- [ ] Configure connection pooling

### Security
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS properly
- [ ] Set secure headers (CSP, HSTS, etc.)
- [ ] Rate limiting configured
- [ ] Input validation enabled
- [ ] SQL injection protection verified

### Performance
- [ ] Redis configured for caching (optional)
- [ ] Database indexes created
- [ ] Static assets compressed
- [ ] CDN configured for assets

### Monitoring
- [ ] Error tracking (Sentry, etc.)
- [ ] APM configured
- [ ] Health check endpoint verified
- [ ] Logging to external service

## Deployment Steps

1. **Backend Deployment**
   ```bash
   npm run build
   npm run db:migrate:deploy
   npm run start
   ```

2. **Frontend Deployment**
   ```bash
   cd frontend
   npm run build
   npm run start
   ```

3. **Post-deployment**
   - [ ] Verify health endpoints
   - [ ] Test authentication flow
   - [ ] Check API endpoints
   - [ ] Monitor error logs
   - [ ] Verify performance metrics

## Rollback Plan
- [ ] Database backup before deployment
- [ ] Previous version tagged in git
- [ ] Rollback scripts prepared
- [ ] Communication plan ready
