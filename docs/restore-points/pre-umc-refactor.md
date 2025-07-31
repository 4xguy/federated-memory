# Restore Point: Pre-UMC Refactor

**Date**: January 31, 2025  
**Tag**: `pre-umc-refactor-2025-01-31`  
**Commit**: 69b0b58  
**Branch**: main

## Purpose

This restore point was created before implementing the Universal Memory Cell (UMC) architecture refactoring. The refactoring involves:

1. Removing separate entity tables (Project, Task, Category, etc.)
2. Ensuring all data is stored only in memory tables with JSONB metadata
3. Fixing module table references (Church and ProjectManagement modules)
4. Creating a pure UMC architecture

## Current State

### Database Tables Being Removed
- `Project`
- `Task` 
- `TaskDependency`
- `RecurringTask`
- `Category`
- `CategoryMemory`

### Module Issues Being Fixed
- ChurchModule using `work_memories` instead of `church_memories`
- ProjectManagementModule using `work_memories` instead of `project_management_memories`
- Missing `ChurchMemory` table in schema

### Memory Tables (Retained)
- `TechnicalMemory`
- `PersonalMemory`
- `WorkMemory`
- `LearningMemory`
- `CommunicationMemory`
- `CreativeMemory`
- `ProjectManagementMemory`
- `ChurchMemory` (to be added)

## How to Restore

If you need to restore to this point:

```bash
# Fetch all tags
git fetch --tags

# Check out the restore point
git checkout pre-umc-refactor-2025-01-31

# Or reset your branch to this point
git reset --hard pre-umc-refactor-2025-01-31

# Restore database schema
npx prisma migrate deploy
```

## What Was Changed After This Point

The UMC refactoring includes:
1. Adding ChurchMemory model
2. Updating module table references
3. Removing non-UMC entity tables
4. Ensuring all domain data exists only as memories with metadata

## Notes

- All 36 MCP tools continue to work after refactoring
- Data is not lost - entities are stored as memories with structured metadata
- This creates a pure semantic/graph/SQL hybrid database through the UMC pattern