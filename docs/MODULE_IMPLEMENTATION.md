# Module Implementation Guide

## Creating a Module

### 1. Module Structure
Each module must extend the base module class and implement required interfaces:

```typescript
// src/modules/technical/technical.module.ts
import { BaseModule } from '@/core/modules/base.module';
import { MemoryModule, ModuleConfig } from '@/core/modules/interfaces';

export class TechnicalModule extends BaseModule implements MemoryModule {
  constructor(config: ModuleConfig) {
    super(config);
  }

  // Required methods
  async store(userId: string, content: string, metadata?: Record<string, any>): Promise<string> {
    // Implementation
  }

  async search(userId: string, query: string, options?: SearchOptions): Promise<Memory[]> {
    // Implementation
  }

  async get(userId: string, memoryId: string): Promise<Memory | null> {
    // Implementation
  }

  async update(userId: string, memoryId: string, updates: Partial<Memory>): Promise<boolean> {
    // Implementation
  }

  async delete(userId: string, memoryId: string): Promise<boolean> {
    // Implementation
  }

  // Module-specific methods
  async searchByLanguage(userId: string, language: string): Promise<Memory[]> {
    // Custom implementation
  }
}
```

### 2. Module Schema
Define module-specific metadata:

```typescript
// src/modules/technical/technical.schema.ts
import { z } from 'zod';

export const TechnicalMetadataSchema = z.object({
  tool: z.string().optional(),
  language: z.string().optional(),
  framework: z.string().optional(),
  error_type: z.string().optional(),
  code_snippet: z.string().optional(),
  file_path: z.string().optional(),
  line_numbers: z.array(z.number()).optional(),
  tags: z.array(z.string()).optional()
});

export type TechnicalMetadata = z.infer<typeof TechnicalMetadataSchema>;
```

### 3. Module Service
Implement business logic:

```typescript
// src/modules/technical/technical.service.ts
export class TechnicalService {
  async classifyContent(content: string): Promise<TechnicalMetadata> {
    // Analyze content to extract metadata
    const language = this.detectLanguage(content);
    const framework = this.detectFramework(content);
    const codeSnippet = this.extractCode(content);
    
    return {
      language,
      framework,
      code_snippet: codeSnippet,
      tags: this.generateTags(content)
    };
  }

  private detectLanguage(content: string): string | undefined {
    // Language detection logic
  }

  private detectFramework(content: string): string | undefined {
    // Framework detection logic
  }
}
```

### 4. Module Configuration
Each module needs configuration:

```typescript
// src/config/modules.ts
export const moduleConfigs: Record<string, ModuleConfig> = {
  technical: {
    id: 'technical',
    name: 'Technical Knowledge',
    description: 'Programming, debugging, and technical documentation',
    tableName: 'technical_memories',
    features: {
      codeExtraction: true,
      errorPatternMatching: true,
      frameworkDetection: true
    },
    metadata: {
      searchableFields: ['tool', 'language', 'framework'],
      requiredFields: [],
      indexedFields: ['language', 'framework']
    }
  }
};
```

## Module Integration

### 1. Registration
Modules are auto-registered on startup:

```typescript
// src/core/modules/loader.service.ts
export class ModuleLoader {
  async loadModules(): Promise<void> {
    const activeModules = process.env.ACTIVE_MODULES?.split(',') || [];
    
    for (const moduleId of activeModules) {
      const modulePath = path.join(this.modulesPath, moduleId);
      const ModuleClass = await import(modulePath);
      const config = moduleConfigs[moduleId];
      
      const instance = new ModuleClass.default(config);
      this.registry.register(moduleId, instance);
    }
  }
}
```

### 2. CMI Integration
Update the CMI when storing memories:

```typescript
async store(userId: string, content: string, metadata?: Record<string, any>): Promise<string> {
  // Generate embeddings
  const fullEmbedding = await this.embeddingService.generate(content, 1536);
  const indexEmbedding = await this.embeddingService.compress(fullEmbedding, 512);
  
  // Store in module
  const memory = await this.db.technical_memories.create({
    data: {
      user_id: userId,
      content,
      embedding: fullEmbedding,
      metadata: metadata || {},
      created_at: new Date()
    }
  });
  
  // Update CMI
  await this.cmi.index({
    user_id: userId,
    module_id: this.config.id,
    remote_memory_id: memory.id,
    embedding: indexEmbedding,
    title: this.extractTitle(content),
    summary: this.generateSummary(content),
    keywords: this.extractKeywords(content),
    categories: metadata?.categories || []
  });
  
  return memory.id;
}
```

### 3. Module-Specific Features
Each module can have unique capabilities:

```typescript
// Technical Module: Code extraction
async extractCodeBlocks(content: string): Promise<CodeBlock[]> {
  const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: CodeBlock[] = [];
  
  let match;
  while ((match = codeRegex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || 'plain',
      code: match[2],
      position: match.index
    });
  }
  
  return blocks;
}

// Personal Module: Emotional analysis
async analyzeEmotionalContext(content: string): Promise<EmotionalContext> {
  // Use sentiment analysis
  const sentiment = await this.sentimentAnalyzer.analyze(content);
  
  return {
    valence: sentiment.score,
    emotions: sentiment.emotions,
    intensity: sentiment.intensity
  };
}
```

## Module Testing

### 1. Unit Tests
```typescript
// tests/modules/technical/technical.test.ts
describe('TechnicalModule', () => {
  let module: TechnicalModule;
  
  beforeEach(() => {
    module = new TechnicalModule(testConfig);
  });
  
  describe('store', () => {
    it('should extract code snippets', async () => {
      const content = 'Here is some code:\n```js\nconsole.log("test");\n```';
      const id = await module.store('user1', content);
      
      const memory = await module.get('user1', id);
      expect(memory?.metadata.code_snippet).toBe('console.log("test");');
      expect(memory?.metadata.language).toBe('javascript');
    });
  });
});
```

### 2. Integration Tests
```typescript
describe('Technical Module Integration', () => {
  it('should update CMI when storing memory', async () => {
    const id = await technicalModule.store('user1', 'TypeScript code...');
    
    const indexEntry = await cmi.findByRemoteId('technical', id);
    expect(indexEntry).toBeDefined();
    expect(indexEntry.module_id).toBe('technical');
  });
});
```

## Best Practices

1. **Metadata Extraction**: Always extract relevant metadata on store
2. **Validation**: Use Zod schemas for metadata validation
3. **Error Handling**: Graceful degradation if module features fail
4. **Performance**: Batch operations when possible
5. **Testing**: 100% coverage for core module methods
6. **Documentation**: Clear JSDoc comments for module-specific methods