#!/bin/bash

# Quick start script for BigMemory to Federated Memory migration

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}BigMemory Migration Quick Start${NC}"
echo -e "${BLUE}==============================${NC}"
echo ""

# Check if SOURCE_DATABASE_URL is set
if [ -z "$SOURCE_DATABASE_URL" ]; then
    echo -e "${YELLOW}SOURCE_DATABASE_URL not set!${NC}"
    echo ""
    echo "Please set your BigMemory PostgreSQL URL:"
    echo "export SOURCE_DATABASE_URL='postgresql://user:password@host:port/database'"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "This script will help you migrate from BigMemory to Federated Memory."
echo ""
echo -e "${BLUE}Steps:${NC}"
echo "1. Check BigMemory database connection"
echo "2. Backup both databases"
echo "3. Run a dry-run migration"
echo "4. (Optional) Run the actual migration"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# Step 1: Check BigMemory
echo -e "\n${BLUE}Step 1: Checking BigMemory database...${NC}"
npm run migrate:check
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Fix the connection issues above before continuing.${NC}"
    exit 1
fi

# Step 2: Create backups
echo -e "\n${BLUE}Step 2: Creating database backups...${NC}"
read -p "Create backups now? (recommended) (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run migrate:backup
fi

# Step 3: Dry run
echo -e "\n${BLUE}Step 3: Running migration dry-run...${NC}"
echo "This will show what would be migrated without making changes."
echo ""
npm run migrate:bigmemory -- --dry-run --batch-size 10

# Step 4: Ask about real migration
echo -e "\n${BLUE}Migration dry-run complete!${NC}"
echo ""
echo "Review the output above. If everything looks good, you can run the actual migration."
echo ""
echo -e "${YELLOW}WARNING: The actual migration will modify your Federated Memory database.${NC}"
echo ""
read -p "Run the actual migration now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Choose migration options:"
    echo "1. Basic migration (regenerate embeddings)"
    echo "2. Preserve embeddings (faster)"
    echo ""
    read -p "Select option (1-2): " -n 1 -r
    echo
    
    if [[ $REPLY == "2" ]]; then
        echo -e "\n${BLUE}Running migration with preserved embeddings...${NC}"
        npm run migrate:bigmemory -- --preserve-embeddings --batch-size 100
    else
        echo -e "\n${BLUE}Running basic migration...${NC}"
        npm run migrate:bigmemory -- --batch-size 100
    fi
    
    echo -e "\n${GREEN}Migration complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Verify the migration: npm run test:api"
    echo "2. Update CMI index: npm run cmi:populate"
    echo "3. Test memory search in your application"
else
    echo ""
    echo "Migration skipped. When you're ready, run:"
    echo ""
    echo "  npm run migrate:bigmemory"
    echo ""
    echo "Or with options:"
    echo "  npm run migrate:bigmemory -- --preserve-embeddings --batch-size 100"
fi