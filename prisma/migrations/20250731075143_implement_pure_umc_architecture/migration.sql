-- CreateTable for Universal Memory Cell architecture
CREATE TABLE IF NOT EXISTS "church_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "church_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "church_memories_userId_idx" ON "church_memories"("userId");

-- Drop non-UMC tables if they exist
DROP TABLE IF EXISTS "categories" CASCADE;
DROP TABLE IF EXISTS "category_memories" CASCADE;
DROP TABLE IF EXISTS "projects" CASCADE;
DROP TABLE IF EXISTS "tasks" CASCADE;
DROP TABLE IF EXISTS "task_dependencies" CASCADE;
DROP TABLE IF EXISTS "recurring_tasks" CASCADE;