#!/bin/bash

echo "🚀 Preparing for Production Deployment"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track errors
ERRORS=0

# Function to check status
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        ((ERRORS++))
    fi
}

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ $2 exists${NC}"
    else
        echo -e "${RED}❌ $2 missing${NC}"
        ((ERRORS++))
    fi
}

echo -e "\n${BLUE}1. Checking Backend Configuration${NC}"
echo "-----------------------------------"

# Check backend build
cd /home/keith/ai/federated-memory
echo "Building backend..."
npm run build > /dev/null 2>&1
check_status $? "Backend builds successfully"

# Check TypeScript
npm run typecheck > /dev/null 2>&1
check_status $? "TypeScript check passes"

# Check environment files
check_file ".env.production" "Production environment file"
check_file "prisma/schema.prisma" "Prisma schema"

# Check database migrations
echo -e "\n${BLUE}2. Checking Database${NC}"
echo "--------------------"
npx prisma migrate status > /dev/null 2>&1
MIGRATE_STATUS=$?
if [ $MIGRATE_STATUS -eq 0 ]; then
    echo -e "${GREEN}✅ Database migrations are up to date${NC}"
else
    echo -e "${YELLOW}⚠️  Database migrations need to be applied${NC}"
fi

echo -e "\n${BLUE}3. Checking Frontend Configuration${NC}"
echo "-----------------------------------"

# Check frontend build
cd frontend
echo "Building frontend..."
npm run build > /dev/null 2>&1
check_status $? "Frontend builds successfully"

# Check environment
check_file ".env.production" "Frontend production environment"

echo -e "\n${BLUE}4. Security Checklist${NC}"
echo "---------------------"

# Check for sensitive data
cd /home/keith/ai/federated-memory
echo "Checking for exposed secrets..."

# Check for common secret patterns
SECRET_PATTERNS=(
    "sk-[a-zA-Z0-9]+"  # OpenAI keys
    "password.*=.*['\"].*['\"]"
    "secret.*=.*['\"].*['\"]"
    "token.*=.*['\"].*['\"]"
)

FOUND_SECRETS=0
for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -r -E "$pattern" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next . > /dev/null 2>&1; then
        ((FOUND_SECRETS++))
    fi
done

if [ $FOUND_SECRETS -eq 0 ]; then
    echo -e "${GREEN}✅ No exposed secrets found in code${NC}"
else
    echo -e "${RED}❌ Potential secrets found in code${NC}"
    ((ERRORS++))
fi

# Check CORS configuration
echo "Checking CORS configuration..."
if grep -q "cors" src/server.ts; then
    echo -e "${GREEN}✅ CORS middleware configured${NC}"
else
    echo -e "${YELLOW}⚠️  CORS middleware not found${NC}"
fi

echo -e "\n${BLUE}5. Performance Checklist${NC}"
echo "------------------------"

# Check for console.log statements
CONSOLE_COUNT=$(grep -r "console.log" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next src frontend/src 2>/dev/null | wc -l)
if [ $CONSOLE_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ No console.log statements in production code${NC}"
else
    echo -e "${YELLOW}⚠️  Found $CONSOLE_COUNT console.log statements${NC}"
fi

# Check bundle size
cd frontend
if [ -d ".next" ]; then
    BUNDLE_SIZE=$(du -sh .next | cut -f1)
    echo -e "${GREEN}✅ Frontend bundle size: $BUNDLE_SIZE${NC}"
fi

echo -e "\n${BLUE}6. Deployment Requirements${NC}"
echo "--------------------------"

# Create deployment checklist
cd /home/keith/ai/federated-memory
cat > DEPLOYMENT_CHECKLIST.md << 'EOF'
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
EOF

echo -e "${GREEN}✅ Created DEPLOYMENT_CHECKLIST.md${NC}"

echo -e "\n${BLUE}7. Summary${NC}"
echo "----------"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! System appears ready for production.${NC}"
    echo -e "\nNext steps:"
    echo -e "1. Review DEPLOYMENT_CHECKLIST.md"
    echo -e "2. Configure production environment variables"
    echo -e "3. Set up production database"
    echo -e "4. Deploy to staging environment first"
else
    echo -e "${RED}❌ Found $ERRORS issues that need to be resolved.${NC}"
    echo -e "\nPlease fix the issues above before deploying to production."
fi

exit $ERRORS