#!/bin/bash

echo "🚀 Pre-Deployment Check for Railway"
echo "==================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to check status
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        ((ERRORS++))
    fi
}

# Function to warn
warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

echo -e "\n${BLUE}1. Checking Git Status${NC}"
echo "----------------------"

# Check if we're in a git repo
if [ -d .git ]; then
    # Check for uncommitted changes
    if [[ -n $(git status --porcelain) ]]; then
        warn "Uncommitted changes detected"
        git status --short
    else
        echo -e "${GREEN}✅ No uncommitted changes${NC}"
    fi
    
    # Check current branch
    BRANCH=$(git branch --show-current)
    echo -e "Current branch: ${BLUE}$BRANCH${NC}"
    
    # Check if branch is up to date with remote
    git fetch origin $BRANCH --quiet
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/$BRANCH)
    
    if [ $LOCAL = $REMOTE ]; then
        echo -e "${GREEN}✅ Branch is up to date with remote${NC}"
    else
        warn "Branch is not up to date with remote"
    fi
else
    echo -e "${RED}❌ Not in a git repository${NC}"
    ((ERRORS++))
fi

echo -e "\n${BLUE}2. Backend Build Check${NC}"
echo "----------------------"

# Check TypeScript compilation
echo "Compiling TypeScript..."
npm run build > /dev/null 2>&1
check_status $? "TypeScript compilation"

# Check for dist folder
if [ -d "dist" ]; then
    echo -e "${GREEN}✅ Build output exists${NC}"
else
    echo -e "${RED}❌ Build output missing${NC}"
    ((ERRORS++))
fi

echo -e "\n${BLUE}3. Frontend Build Check${NC}"
echo "-----------------------"

cd frontend
echo "Building frontend..."
npm run build > /dev/null 2>&1
check_status $? "Frontend build"

if [ -d ".next" ]; then
    echo -e "${GREEN}✅ Frontend build output exists${NC}"
else
    echo -e "${RED}❌ Frontend build output missing${NC}"
    ((ERRORS++))
fi
cd ..

echo -e "\n${BLUE}4. Railway Configuration${NC}"
echo "------------------------"

# Check railway.json
if [ -f "railway.json" ]; then
    echo -e "${GREEN}✅ railway.json exists${NC}"
else
    echo -e "${RED}❌ railway.json missing${NC}"
    ((ERRORS++))
fi

if [ -f "frontend/railway.json" ]; then
    echo -e "${GREEN}✅ frontend/railway.json exists${NC}"
else
    echo -e "${RED}❌ frontend/railway.json missing${NC}"
    ((ERRORS++))
fi

echo -e "\n${BLUE}5. Database Migrations${NC}"
echo "----------------------"

# Check for pending migrations
npx prisma migrate status > /tmp/migrate_status.txt 2>&1
if grep -q "Database schema is up to date" /tmp/migrate_status.txt; then
    echo -e "${GREEN}✅ No pending migrations${NC}"
elif grep -q "Following migration" /tmp/migrate_status.txt; then
    warn "Pending migrations detected - will be applied on deployment"
else
    echo -e "${GREEN}✅ Migration status checked${NC}"
fi

echo -e "\n${BLUE}6. Environment Variables${NC}"
echo "------------------------"

echo "The following environment variables should be set in Railway:"
echo ""
echo "Backend (required):"
echo "  - DATABASE_URL"
echo "  - OPENAI_API_KEY"
echo "  - JWT_SECRET"
echo "  - SESSION_SECRET"
echo "  - BASE_URL (should be https://federated-memory-production.up.railway.app)"
echo ""
echo "Backend (optional but recommended):"
echo "  - REDIS_URL"
echo "  - GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET"
echo "  - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET"
echo "  - SMTP settings for email"
echo ""
echo "Frontend:"
echo "  - NEXT_PUBLIC_API_URL (should point to backend API)"
echo "  - NEXTAUTH_SECRET (same as SESSION_SECRET)"

echo -e "\n${BLUE}7. Security Check${NC}"
echo "-----------------"

# Check for .env files that shouldn't be committed
if [ -f ".env" ]; then
    if git ls-files --error-unmatch .env > /dev/null 2>&1; then
        echo -e "${RED}❌ .env file is tracked by git!${NC}"
        ((ERRORS++))
    else
        echo -e "${GREEN}✅ .env file is not tracked${NC}"
    fi
fi

# Quick check for exposed secrets in code
echo "Checking for potential exposed secrets..."
SECRETS_FOUND=$(grep -r "sk-" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next src frontend/src 2>/dev/null | grep -v "sk-test" | wc -l)
if [ $SECRETS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ No exposed secrets found${NC}"
else
    warn "Potential secrets found in code ($SECRETS_FOUND occurrences)"
fi

echo -e "\n${BLUE}8. Summary${NC}"
echo "----------"

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ All checks passed! Ready to deploy.${NC}"
    else
        echo -e "${YELLOW}⚠️  $WARNINGS warnings found but deployment can proceed.${NC}"
    fi
    echo -e "\nTo deploy:"
    echo -e "1. Commit your changes: ${BLUE}git add . && git commit -m 'Your message'${NC}"
    echo -e "2. Push to deploy: ${BLUE}git push origin main${NC}"
    echo -e "3. Railway will automatically deploy from the main branch"
else
    echo -e "${RED}❌ $ERRORS errors found. Please fix before deploying.${NC}"
fi

echo -e "\n${BLUE}Post-Deployment Steps:${NC}"
echo "1. Check Railway logs for any errors"
echo "2. Test the health endpoint: https://federated-memory-production.up.railway.app/api/health"
echo "3. Test authentication flow"
echo "4. Verify database connectivity"
echo "5. Test key API endpoints"

exit $ERRORS