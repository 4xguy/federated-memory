-- Add indexes for optimized metadata queries
-- These significantly improve performance for structured queries

-- Work module indexes (projects, tasks, dependencies)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_memories_type 
ON work_memories ((metadata->>'type'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_memories_type_status 
ON work_memories ((metadata->>'type'), (metadata->>'status'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_memories_project_id 
ON work_memories ((metadata->>'projectId')) 
WHERE metadata->>'type' = 'task';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_memories_task_id 
ON work_memories ((metadata->>'id')) 
WHERE metadata->>'type' = 'task';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_memories_dependency 
ON work_memories ((metadata->>'taskId'), (metadata->>'dependsOnTaskId')) 
WHERE metadata->>'type' = 'task_dependency';

-- Personal module indexes (registries, categories)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_personal_memories_type 
ON personal_memories ((metadata->>'type'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_personal_memories_registry 
ON personal_memories ((metadata->>'type'), (metadata->>'registryType')) 
WHERE metadata->>'type' = 'registry';

-- Category indexes across all modules
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_personal_memories_category 
ON personal_memories ((metadata->>'category'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_memories_category 
ON work_memories ((metadata->>'category'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_technical_memories_category 
ON technical_memories ((metadata->>'category'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learning_memories_category 
ON learning_memories ((metadata->>'category'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creative_memories_category 
ON creative_memories ((metadata->>'category'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_communication_memories_category 
ON communication_memories ((metadata->>'category'));

-- User + type composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_memories_user_type 
ON work_memories ("userId", (metadata->>'type'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_personal_memories_user_type 
ON personal_memories ("userId", (metadata->>'type'));

-- Priority and date indexes for task sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_memories_priority 
ON work_memories ((metadata->>'priority')) 
WHERE metadata->>'type' = 'task';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_memories_due_date 
ON work_memories ((metadata->>'dueDate')) 
WHERE metadata->>'type' = 'task';

-- Analyze tables to update statistics
ANALYZE work_memories;
ANALYZE personal_memories;
ANALYZE technical_memories;
ANALYZE learning_memories;
ANALYZE creative_memories;
ANALYZE communication_memories;