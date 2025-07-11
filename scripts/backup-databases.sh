#!/bin/bash

# Backup script for both BigMemory and Federated Memory databases
# Creates timestamped backups in the backups directory

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create backups directory if it doesn't exist
BACKUP_DIR="./backups/migration-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo -e "${BLUE}Database Backup Script${NC}"
echo -e "${BLUE}=====================${NC}"
echo ""

# Function to extract database name from URL
extract_db_info() {
    local url=$1
    # Extract database name from PostgreSQL URL
    # Format: postgresql://user:pass@host:port/database
    echo "$url" | sed -E 's|.*://[^/]+/([^?]+).*|\1|'
}

# Function to create backup
backup_database() {
    local db_url=$1
    local backup_name=$2
    local description=$3
    
    echo -e "${YELLOW}Backing up $description...${NC}"
    
    # Extract connection details from URL (supports both postgresql:// and postgres://)
    if [[ $db_url =~ postgres(ql)?://([^:]+):([^@]+)@([^:]+):([^/]+)/([^?]+) ]]; then
        local user="${BASH_REMATCH[2]}"
        local password="${BASH_REMATCH[3]}"
        local host="${BASH_REMATCH[4]}"
        local port="${BASH_REMATCH[5]}"
        local database="${BASH_REMATCH[6]}"
        
        # Remove any query parameters from database name
        database=$(echo "$database" | cut -d'?' -f1)
        
        local backup_file="$BACKUP_DIR/${backup_name}_${database}_$(date +%Y%m%d-%H%M%S).sql"
        
        # Create backup using pg_dump
        PGPASSWORD="$password" pg_dump \
            -h "$host" \
            -p "$port" \
            -U "$user" \
            -d "$database" \
            -f "$backup_file" \
            --verbose \
            --no-owner \
            --no-privileges \
            --if-exists \
            --clean
        
        # Compress the backup
        gzip "$backup_file"
        
        echo -e "${GREEN}✓ Backed up to: ${backup_file}.gz${NC}"
        echo -e "  Database: $database"
        echo -e "  Host: $host:$port"
        echo ""
        
        return 0
    else
        echo -e "${RED}✗ Invalid database URL format for $description${NC}"
        return 1
    fi
}

# Check for required environment variables or arguments
if [ -z "$1" ] && [ -z "$SOURCE_DATABASE_URL" ]; then
    echo -e "${RED}Error: BigMemory database URL not provided${NC}"
    echo "Usage: $0 [source_db_url] [target_db_url]"
    echo "Or set SOURCE_DATABASE_URL and DATABASE_URL environment variables"
    exit 1
fi

if [ -z "$2" ] && [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: Federated Memory database URL not provided${NC}"
    echo "Usage: $0 [source_db_url] [target_db_url]"
    echo "Or set SOURCE_DATABASE_URL and DATABASE_URL environment variables"
    exit 1
fi

# Use arguments if provided, otherwise use environment variables
SOURCE_DB="${1:-$SOURCE_DATABASE_URL}"
TARGET_DB="${2:-$DATABASE_URL}"

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}Error: pg_dump not found. Please install PostgreSQL client tools.${NC}"
    echo "On Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo "On macOS: brew install postgresql"
    exit 1
fi

# Create backup info file
cat > "$BACKUP_DIR/backup-info.txt" << EOF
Backup Information
==================
Date: $(date)
Source DB: $(extract_db_info "$SOURCE_DB")
Target DB: $(extract_db_info "$TARGET_DB")
Purpose: Pre-migration backup

Restore Instructions
===================
To restore a backup:
1. Decompress: gunzip backup_file.sql.gz
2. Restore: psql -h host -p port -U user -d database < backup_file.sql

Or in one command:
gunzip -c backup_file.sql.gz | psql -h host -p port -U user -d database
EOF

# Perform backups
echo "Creating backups in: $BACKUP_DIR"
echo ""

# Backup BigMemory database
if backup_database "$SOURCE_DB" "bigmemory" "BigMemory Database"; then
    BIGMEMORY_BACKUP=true
else
    BIGMEMORY_BACKUP=false
fi

# Backup Federated Memory database
if backup_database "$TARGET_DB" "federated" "Federated Memory Database"; then
    FEDERATED_BACKUP=true
else
    FEDERATED_BACKUP=false
fi

# Summary
echo -e "${BLUE}Backup Summary${NC}"
echo -e "${BLUE}==============${NC}"

if [ "$BIGMEMORY_BACKUP" = true ] && [ "$FEDERATED_BACKUP" = true ]; then
    echo -e "${GREEN}✓ All backups completed successfully${NC}"
    echo -e "Backup location: $BACKUP_DIR"
    
    # Show backup sizes
    echo ""
    echo "Backup sizes:"
    du -h "$BACKUP_DIR"/*.gz 2>/dev/null | sed 's/^/  /'
    
    exit 0
else
    echo -e "${RED}✗ Some backups failed${NC}"
    [ "$BIGMEMORY_BACKUP" = false ] && echo -e "  ${RED}✗ BigMemory backup failed${NC}"
    [ "$FEDERATED_BACKUP" = false ] && echo -e "  ${RED}✗ Federated Memory backup failed${NC}"
    exit 1
fi