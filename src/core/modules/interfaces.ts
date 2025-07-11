import { z } from 'zod';

// ============= Base Types =============

export interface Memory {
  id: string;
  userId: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
  accessCount: number;
  lastAccessed: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  filters?: Record<string, any>;
  includeEmbedding?: boolean;
  minScore?: number;
}

export interface SearchResult extends Memory {
  score: number;
  module: string;
}

// ============= Module Types =============

export type ModuleType = 'standard' | 'specialized' | 'external';

// ============= Module Configuration =============

export interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  tableName: string;
  maxMemorySize?: number;
  retentionDays?: number;
  searchLimit?: number;
  enableVersioning?: boolean;
  enableEncryption?: boolean;
  features?: {
    codeExtraction?: boolean;
    errorPatternMatching?: boolean;
    frameworkDetection?: boolean;
    emotionalAnalysis?: boolean;
    timeBasedRetrieval?: boolean;
    threadManagement?: boolean;
    ideaLinking?: boolean;
  };
  metadata?: {
    searchableFields: string[];
    requiredFields: string[];
    indexedFields: string[];
  };
}

// ============= Module Interface =============

export interface MemoryModule {
  // Core methods
  store(userId: string, content: string, metadata?: Record<string, any>): Promise<string>;
  search(userId: string, query: string, options?: SearchOptions): Promise<Memory[]>;
  searchByEmbedding(
    userId: string,
    embedding: number[],
    options?: SearchOptions,
  ): Promise<Memory[]>;
  get(userId: string, memoryId: string): Promise<Memory | null>;
  update(userId: string, memoryId: string, updates: Partial<Memory>): Promise<boolean>;
  delete(userId: string, memoryId: string): Promise<boolean>;

  // Module info
  getConfig(): ModuleConfig;
  getStats(userId: string): Promise<ModuleStats>;

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

// ============= Module Statistics =============

export interface ModuleStats {
  totalMemories: number;
  totalSize: number;
  lastAccessed?: Date;
  mostFrequentCategories: string[];
  averageAccessCount: number;
}

// ============= CMI Types =============

export interface CMIEntry {
  id: string;
  userId: string;
  moduleId: string;
  remoteMemoryId: string;
  embedding?: number[];
  title?: string;
  summary?: string;
  keywords: string[];
  categories: string[];
  importanceScore: number;
  accessCount: number;
  lastAccessed: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutingDecision {
  moduleId: string;
  confidence: number;
  reason: string;
}

// ============= Validation Schemas =============

export const StoreMemorySchema = z.object({
  content: z.string().min(1),
  module: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const SearchMemorySchema = z.object({
  query: z.string().min(1),
  modules: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
  filters: z.record(z.any()).optional(),
});

export const UpdateMemorySchema = z.object({
  module: z.string(),
  memoryId: z.string().uuid(),
  content: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// ============= Event Types =============

export interface MemoryEvent {
  type: 'created' | 'updated' | 'deleted' | 'accessed';
  userId: string;
  moduleId: string;
  memoryId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// ============= Error Types =============

export class ModuleError extends Error {
  constructor(
    public module: string,
    public code: string,
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'ModuleError';
  }
}

export class CMIError extends Error {
  constructor(
    public code: string,
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'CMIError';
  }
}
