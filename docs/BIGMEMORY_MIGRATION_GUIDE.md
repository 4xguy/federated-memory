# BigMemory to Federated Memory Migration Guide

This guide explains how to migrate data from the BigMemory system to the new Federated Memory system.

## Overview

Both BigMemory and Federated Memory use a flexible, metadata-driven approach for storing memories. The migration process:

1. Maps BigMemory memories to appropriate Federated Memory modules
2. Preserves all metadata, relationships, and timestamps
3. Optionally preserves existing embeddings or regenerates them
4. Maintains project-task relationships through the metadata system

## Prerequisites

1. **PostgreSQL Client Tools**: Required for database backups
   ```bash
   # Ubuntu/Debian
   sudo apt-get install postgresql-client
   
   # macOS
   brew install postgresql
   ```

2. **Database URLs**: You need connection strings for both databases
   ```bash
   # Set environment variables
   export SOURCE_DATABASE_URL="postgresql://user:pass@host:port/bigmemory"
   export DATABASE_URL="postgresql://user:pass@host:port/federated_memory"
   ```

3. **Node.js 20+**: Required for running the migration scripts

## Migration Process

### Step 1: Backup Both Databases

Always create backups before migration:

```bash
npm run migrate:backup
```

This creates timestamped backups in `./backups/migration-YYYYMMDD-HHMMSS/`

### Step 2: Test Migration (Dry Run)

Run a test migration to see what would be migrated:

```bash
npm run migrate:test
```

This will:
- Check connections to both databases
- Show statistics about data to be migrated
- Run a dry-run migration showing what would happen
- Not make any actual changes

### Step 3: Run the Migration

Once you're satisfied with the dry run results:

```bash
# Basic migration (regenerates embeddings)
npm run migrate:bigmemory

# Preserve existing embeddings (faster)
npm run migrate:bigmemory -- --preserve-embeddings

# Custom batch size for large databases
npm run migrate:bigmemory -- --batch-size 500
```

## Migration Options

| Option | Description | Default |
|--------|-------------|---------|
| `--source-db <url>` | BigMemory database URL | `SOURCE_DATABASE_URL` env |
| `--target-db <url>` | Federated Memory database URL | `DATABASE_URL` env |
| `--batch-size <n>` | Number of memories to process at once | 100 |
| `--preserve-embeddings` | Keep existing embeddings instead of regenerating | false |
| `--dry-run` | Show what would be migrated without making changes | false |
| `--user-map <file>` | JSON file mapping BigMemory userIds to Federated userIds | auto-detect |

## Module Mapping

The migration automatically maps BigMemory memories to Federated Memory modules:

| BigMemory Category/Type | Federated Module | Based On |
|------------------------|------------------|----------|
| Projects, Tasks | `work` | metadata.type, tags, content |
| Personal memories | `personal` | category, content analysis |
| Technical content | `technical` | code patterns, technical terms |
| Learning materials | `learning` | educational keywords |
| Communications | `communication` | email/message patterns |
| Creative content | `creative` | creative keywords |

## What Gets Migrated

### Memories
- Content and embeddings
- All metadata (preserved and transformed)
- Timestamps (created, updated, accessed)
- Access counts
- Tags and categories
- Soft-deleted memories are excluded

### Relationships
- Memory-to-memory relationships
- Project-task associations
- Relationship types and strengths

### Users
- Matched by token if exists
- Created if not present (optional)
- Email and basic info preserved

## Post-Migration Verification

After migration, verify the results:

```bash
# Check CMI index
npm run cmi:populate

# Test memory search
npm run test:api

# Check module statistics
tsx scripts/check-module-stats.ts
```

## Troubleshooting

### Connection Issues
- Verify DATABASE_URL format: `postgresql://user:pass@host:port/dbname`
- Check network connectivity to databases
- Ensure user has proper permissions

### Memory Mapping Issues
- Check migration logs for classification decisions
- Memories default to 'personal' module if unclear
- Use `--dry-run` to preview classifications

### Performance
- Increase `--batch-size` for faster migration
- Use `--preserve-embeddings` to avoid regeneration
- Run during off-peak hours for production systems

## Rollback

If issues occur, restore from backups:

```bash
# Decompress backup
gunzip backups/migration-*/federated_*.sql.gz

# Restore database
psql -h host -p port -U user -d database < backup.sql
```

## Architecture Comparison

### BigMemory
- Single `memories` table with categories
- Categories stored in metadata
- Projects/tasks as memory types

### Federated Memory
- Multiple module tables (work_memories, personal_memories, etc.)
- Central Memory Index (CMI) for routing
- Same flexible metadata approach

Both systems use the same core principle: everything is a "memory" with rich metadata, allowing infinite extensibility without schema changes.