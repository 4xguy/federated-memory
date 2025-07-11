#!/bin/bash

# Test migration script for local development
# This script sets up test databases and runs a dry-run migration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}BigMemory to Federated Memory Migration Test${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""

# Check if we're in the federated-memory directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    echo -e "${RED}Error: This script must be run from the federated-memory project root${NC}"
    exit 1
fi

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set test database URLs if not provided
if [ -z "$SOURCE_DATABASE_URL" ]; then
    echo -e "${YELLOW}Warning: SOURCE_DATABASE_URL not set${NC}"
    echo "Please set the BigMemory database URL:"
    echo "export SOURCE_DATABASE_URL='postgresql://user:pass@host:port/bigmemory'"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}Warning: DATABASE_URL not set${NC}"
    echo "Using the default from .env file"
fi

# Step 1: Backup databases
echo -e "${BLUE}Step 1: Creating database backups...${NC}"
./scripts/backup-databases.sh
if [ $? -ne 0 ]; then
    echo -e "${RED}Backup failed. Aborting migration test.${NC}"
    exit 1
fi
echo ""

# Step 2: Check BigMemory connection and stats
echo -e "${BLUE}Step 2: Checking BigMemory database...${NC}"
npm run migrate:check
echo ""

# Step 3: Check Federated Memory connection
echo -e "${BLUE}Step 3: Checking Federated Memory database...${NC}"
npm run db:verify
echo ""

# Step 4: Run dry-run migration
echo -e "${BLUE}Step 4: Running migration in DRY-RUN mode...${NC}"
echo -e "${YELLOW}This will analyze what would be migrated without making changes${NC}"
echo ""

# Run migration in dry-run mode
npm run migrate:bigmemory -- --dry-run --batch-size 10

echo ""
echo -e "${GREEN}Test completed!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Review the dry-run output above"
echo "2. If everything looks good, run the actual migration:"
echo "   ${YELLOW}npm run migrate:bigmemory --batch-size 100${NC}"
echo "3. Or run with preserved embeddings:"
echo "   ${YELLOW}npm run migrate:bigmemory --preserve-embeddings${NC}"
echo ""
echo -e "${YELLOW}Note: The actual migration will modify the target database.${NC}"
echo -e "${YELLOW}Make sure you have backups before proceeding!${NC}"