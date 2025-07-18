-- Add Project Management Module Migration

-- 1. Add email/password fields to User table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- 2. Create Project Management Memory table
CREATE TABLE IF NOT EXISTS project_management_memories (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB NOT NULL DEFAULT '{}',
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Add indexes for Project Management Memory
CREATE INDEX IF NOT EXISTS "project_management_memories_userId_idx" ON project_management_memories("userId");
CREATE INDEX IF NOT EXISTS "project_management_memories_createdAt_idx" ON project_management_memories("createdAt");
CREATE INDEX IF NOT EXISTS "project_management_memories_updatedAt_idx" ON project_management_memories("updatedAt");

-- Add GIN index for metadata searches
CREATE INDEX IF NOT EXISTS "project_management_memories_metadata_idx" ON project_management_memories USING GIN (metadata);

-- 3. Insert Project Management module into memory_modules if not exists
INSERT INTO memory_modules ("moduleId", "moduleName", description, "moduleType", configuration, "isActive", "createdAt")
VALUES (
    'project-management',
    'Project Management',
    'Manages projects, tasks, subtasks, and todo lists with ministry tracking',
    'standard',
    '{
        "tableName": "project_management_memories",
        "features": {
            "projectTracking": true,
            "taskManagement": true,
            "subtaskSupport": true,
            "todoLists": true,
            "ministryTracking": true,
            "dependencyManagement": true,
            "recurringTasks": true
        },
        "metadata": {
            "searchableFields": ["type", "status", "priority", "assignee", "ministry", "projectId"],
            "requiredFields": ["type"],
            "indexedFields": ["type", "status", "priority"]
        }
    }'::jsonb,
    true,
    CURRENT_TIMESTAMP
) ON CONFLICT ("moduleId") DO UPDATE
SET configuration = EXCLUDED.configuration;