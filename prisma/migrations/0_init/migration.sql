-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "passwordHash" TEXT,
    "oauthProvider" TEXT,
    "oauthId" TEXT,
    "name" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_index" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "remoteMemoryId" TEXT NOT NULL,
    "embedding" vector(512),
    "title" TEXT,
    "summary" TEXT,
    "keywords" TEXT[],
    "categories" TEXT[],
    "importanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_relationships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceMemoryId" TEXT NOT NULL,
    "targetModule" TEXT NOT NULL,
    "targetMemoryId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_modules" (
    "moduleId" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "description" TEXT,
    "moduleType" TEXT NOT NULL DEFAULT 'standard',
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_modules_pkey" PRIMARY KEY ("moduleId")
);

-- CreateTable
CREATE TABLE "technical_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technical_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "modulesSearched" TEXT[],
    "resultCount" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "query_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_stats" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalQueries" INTEGER NOT NULL DEFAULT 0,
    "totalStores" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "module_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "lastUsed" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_token_key" ON "users"("token");

-- CreateIndex
CREATE INDEX "users_oauthProvider_oauthId_idx" ON "users"("oauthProvider", "oauthId");

-- CreateIndex
CREATE INDEX "memory_index_userId_moduleId_idx" ON "memory_index"("userId", "moduleId");

-- CreateIndex
CREATE INDEX "memory_index_userId_lastAccessed_idx" ON "memory_index"("userId", "lastAccessed");

-- CreateIndex
CREATE UNIQUE INDEX "memory_index_moduleId_remoteMemoryId_key" ON "memory_index"("moduleId", "remoteMemoryId");

-- CreateIndex
CREATE INDEX "memory_relationships_userId_sourceModule_sourceMemoryId_idx" ON "memory_relationships"("userId", "sourceModule", "sourceMemoryId");

-- CreateIndex
CREATE INDEX "memory_relationships_userId_targetModule_targetMemoryId_idx" ON "memory_relationships"("userId", "targetModule", "targetMemoryId");

-- CreateIndex
CREATE UNIQUE INDEX "memory_relationships_sourceModule_sourceMemoryId_targetModu_key" ON "memory_relationships"("sourceModule", "sourceMemoryId", "targetModule", "targetMemoryId", "relationshipType");

-- CreateIndex
CREATE INDEX "technical_memories_userId_idx" ON "technical_memories"("userId");

-- CreateIndex
CREATE INDEX "personal_memories_userId_idx" ON "personal_memories"("userId");

-- CreateIndex
CREATE INDEX "work_memories_userId_idx" ON "work_memories"("userId");

-- CreateIndex
CREATE INDEX "learning_memories_userId_idx" ON "learning_memories"("userId");

-- CreateIndex
CREATE INDEX "communication_memories_userId_idx" ON "communication_memories"("userId");

-- CreateIndex
CREATE INDEX "creative_memories_userId_idx" ON "creative_memories"("userId");

-- CreateIndex
CREATE INDEX "query_logs_userId_createdAt_idx" ON "query_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "module_stats_date_idx" ON "module_stats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "module_stats_moduleId_date_key" ON "module_stats"("moduleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX "api_keys_keyPrefix_idx" ON "api_keys"("keyPrefix");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- AddForeignKey
ALTER TABLE "memory_index" ADD CONSTRAINT "memory_index_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_relationships" ADD CONSTRAINT "memory_relationships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

