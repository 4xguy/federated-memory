#!/bin/bash

echo "🧪 Testing Frontend Build and Configuration..."
echo "============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        return 1
    fi
}

# Check Node.js
echo -e "\n📦 Checking Node.js environment..."
if command_exists node; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✅ Node.js installed: $NODE_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✅ npm installed: $NPM_VERSION${NC}"
else
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi

# Check if we're in the frontend directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Not in frontend directory. Please run from frontend folder.${NC}"
    exit 1
fi

# Install dependencies
echo -e "\n📦 Installing dependencies..."
npm install
print_status $? "Dependencies installed"

# Run TypeScript check
echo -e "\n🔍 Running TypeScript check..."
npm run type-check
TS_RESULT=$?
print_status $TS_RESULT "TypeScript check"

# Run linter
echo -e "\n🔍 Running ESLint..."
npm run lint
LINT_RESULT=$?
print_status $LINT_RESULT "ESLint check"

# Build the project
echo -e "\n🔨 Building frontend..."
npm run build
BUILD_RESULT=$?
print_status $BUILD_RESULT "Frontend build"

# Check if build output exists
if [ -d ".next" ]; then
    echo -e "${GREEN}✅ Build output exists${NC}"
    
    # Check build size
    BUILD_SIZE=$(du -sh .next | cut -f1)
    echo -e "${GREEN}   Build size: $BUILD_SIZE${NC}"
else
    echo -e "${RED}❌ Build output not found${NC}"
    BUILD_RESULT=1
fi

# Check environment configuration
echo -e "\n🔧 Checking environment configuration..."
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✅ .env.local exists${NC}"
    
    # Check for required environment variables
    if grep -q "NEXT_PUBLIC_API_URL" .env.local; then
        echo -e "${GREEN}✅ NEXT_PUBLIC_API_URL configured${NC}"
    else
        echo -e "${YELLOW}⚠️  NEXT_PUBLIC_API_URL not found in .env.local${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env.local not found - using defaults${NC}"
fi

# Test summary
echo -e "\n============================================="
echo -e "📊 Test Summary:"
echo -e "============================================="

TOTAL_ERRORS=0
[ $TS_RESULT -ne 0 ] && ((TOTAL_ERRORS++))
[ $LINT_RESULT -ne 0 ] && ((TOTAL_ERRORS++))
[ $BUILD_RESULT -ne 0 ] && ((TOTAL_ERRORS++))

if [ $TOTAL_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! Frontend is ready.${NC}"
    echo -e "\nNext steps:"
    echo -e "1. Run 'npm run dev' to start development server"
    echo -e "2. Or 'npm run start' to run production build"
    exit 0
else
    echo -e "${RED}❌ $TOTAL_ERRORS test(s) failed${NC}"
    echo -e "\nPlease fix the errors above before proceeding."
    exit 1
fi