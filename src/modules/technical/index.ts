import { BaseModule, ModuleInfo } from '@/core/modules/base.module';
import { Memory, SearchOptions, ModuleStats, ModuleType } from '@/core/modules/interfaces';
import { Prisma } from '@prisma/client';
import { vectorDb } from '@/utils/database';

interface TechnicalMetadata {
  tool?: string;
  language?: string;
  framework?: string;
  errorType?: string;
  codeSnippet?: string;
  stackTrace?: string;
  solution?: string;
  documentationType?: string;
  version?: string;
  dependencies?: string[];
  tags?: string[];
}

export class TechnicalModule extends BaseModule {
  constructor() {
    super({
      id: 'technical',
      name: 'Technical Memory',
      description: 'Stores programming knowledge, debugging information, and technical documentation',
      tableName: 'technical_memories',
      features: {
        codeExtraction: true,
        errorPatternMatching: true,
        frameworkDetection: true
      },
      metadata: {
        searchableFields: ['tool', 'language', 'framework', 'errorType', 'tags'],
        requiredFields: ['content'],
        indexedFields: ['language', 'framework', 'errorType']
      }
    });
  }

  getModuleInfo(): ModuleInfo {
    return {
      name: 'Technical Memory Module',
      description: 'Specialized storage for technical knowledge, code snippets, debugging info, and documentation',
      type: 'specialized' as ModuleType
    };
  }

  async processMetadata(content: string, metadata: Record<string, any>): Promise<Record<string, any>> {
    const enriched: TechnicalMetadata = {
      ...metadata
    };

    // Extract code snippets
    const codeMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
    if (codeMatch) {
      enriched.codeSnippet = codeMatch[1].trim();
    }

    // Detect programming language
    if (!enriched.language) {
      enriched.language = this.detectLanguage(content);
    }

    // Detect framework
    if (!enriched.framework && enriched.language) {
      enriched.framework = this.detectFramework(content, enriched.language);
    }

    // Extract error information
    if (content.toLowerCase().includes('error') || content.toLowerCase().includes('exception')) {
      const errorInfo = this.extractErrorInfo(content);
      if (errorInfo) {
        enriched.errorType = errorInfo.type;
        enriched.stackTrace = errorInfo.stackTrace;
      }
    }

    // Auto-generate tags
    if (!enriched.tags || enriched.tags.length === 0) {
      enriched.tags = this.generateTechnicalTags(content, enriched);
    }

    // Determine importance score based on content type
    const importanceScore = this.calculateTechnicalImportance(content, enriched);

    return {
      ...enriched,
      importanceScore,
      categories: this.categorizeTechnical(enriched)
    };
  }

  formatSearchResult(memory: Memory): Memory {
    const metadata = memory.metadata as TechnicalMetadata;
    
    // Format code snippets for display
    if (metadata.codeSnippet) {
      memory.content = this.formatCodeSnippet(memory.content, metadata.codeSnippet, metadata.language);
    }

    // Add technical context
    if (metadata.errorType) {
      memory.content = `[${metadata.errorType}] ${memory.content}`;
    }

    return memory;
  }

  async searchByEmbedding(
    userId: string,
    embedding: number[],
    options?: SearchOptions
  ): Promise<Memory[]> {
    const results = await vectorDb.searchByEmbedding('technical_memories', userId, embedding, {
      limit: options?.limit,
      minScore: options?.minScore,
      filters: options?.filters
    }) as any[];

    return results.map((memory: any) => this.formatSearchResult({
      ...memory,
      score: memory.score
    }));
  }

  protected async storeInModule(
    userId: string,
    content: string,
    embedding: number[],
    metadata: Record<string, any>
  ): Promise<Memory> {
    const result = await vectorDb.storeWithEmbedding('technical_memories', {
      userId,
      content,
      embedding,
      metadata
    });

    return {
      id: result.id,
      userId: result.userId,
      content: result.content,
      metadata: result.metadata as Record<string, any>,
      embedding,
      accessCount: result.accessCount,
      lastAccessed: result.lastAccessed,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    };
  }

  protected async getFromModule(userId: string, memoryId: string): Promise<Memory | null> {
    const result = await vectorDb.getWithEmbedding('technical_memories', memoryId, userId);

    if (!result) return null;

    return {
      id: result.id,
      userId: result.userId,
      content: result.content,
      metadata: result.metadata as Record<string, any>,
      accessCount: result.accessCount,
      lastAccessed: result.lastAccessed,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    };
  }

  protected async updateInModule(
    userId: string,
    memoryId: string,
    updates: Partial<Memory>
  ): Promise<boolean> {
    try {
      return await vectorDb.updateWithEmbedding('technical_memories', memoryId, userId, {
        content: updates.content,
        embedding: updates.embedding,
        metadata: updates.metadata
      });
    } catch (error) {
      return false;
    }
  }

  protected async deleteFromModule(userId: string, memoryId: string): Promise<boolean> {
    try {
      await this.prisma.technicalMemory.delete({
        where: {
          id: memoryId,
          userId
        }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  protected async calculateStats(userId: string): Promise<ModuleStats> {
    const stats = await this.prisma.technicalMemory.aggregate({
      where: { userId },
      _count: { id: true },
      _avg: { accessCount: true },
      _max: { lastAccessed: true }
    });

    // Get most frequent categories
    const categories = await this.prisma.$queryRaw<{ category: string; count: bigint }[]>`
      SELECT 
        jsonb_array_elements_text(metadata->'categories') as category,
        COUNT(*) as count
      FROM technical_memories
      WHERE "userId" = ${userId}
      GROUP BY category
      ORDER BY count DESC
      LIMIT 5
    `;

    return {
      totalMemories: stats._count.id || 0,
      totalSize: 0, // Calculate if needed
      lastAccessed: stats._max.lastAccessed || undefined,
      mostFrequentCategories: categories.map(c => c.category),
      averageAccessCount: stats._avg.accessCount || 0
    };
  }

  protected async updateAccessCounts(memoryIds: string[]): Promise<void> {
    for (const id of memoryIds) {
      await this.prisma.technicalMemory.update({
        where: { id },
        data: {
          accessCount: { increment: 1 },
          lastAccessed: new Date()
        }
      });
    }
  }

  // Helper methods

  private detectLanguage(content: string): string | undefined {
    const languagePatterns = {
      javascript: /\b(const|let|var|function|=>|async|await|require|import)\b/i,
      typescript: /\b(interface|type|enum|namespace|declare|as)\b/i,
      python: /\b(def|class|import|from|if __name__|print|lambda)\b/i,
      java: /\b(public|private|class|interface|extends|implements|static void)\b/i,
      go: /\b(func|package|import|defer|goroutine|chan)\b/i,
      rust: /\b(fn|mut|impl|trait|match|Some|None)\b/i,
      cpp: /\b(#include|std::|cout|cin|template|namespace)\b/i,
      csharp: /\b(using|namespace|public|private|class|interface|var)\b/i
    };

    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      if (pattern.test(content)) {
        return lang;
      }
    }

    return undefined;
  }

  private detectFramework(content: string, language: string): string | undefined {
    const frameworkPatterns: Record<string, Record<string, RegExp>> = {
      javascript: {
        react: /\b(React|useState|useEffect|JSX|Component)\b/i,
        vue: /\b(Vue|v-model|v-if|v-for|mounted)\b/i,
        angular: /\b(@Component|@Injectable|NgModule|Observable)\b/i,
        express: /\b(express|app\.(get|post|put|delete)|router)\b/i,
        nextjs: /\b(next|getServerSideProps|getStaticProps)\b/i
      },
      python: {
        django: /\b(django|models\.Model|views|urls|migrations)\b/i,
        flask: /\b(Flask|@app\.route|render_template)\b/i,
        fastapi: /\b(FastAPI|@app\.(get|post)|Pydantic)\b/i,
        pytorch: /\b(torch|nn\.Module|tensor|cuda)\b/i,
        tensorflow: /\b(tensorflow|tf\.|keras)\b/i
      }
    };

    const patterns = frameworkPatterns[language];
    if (!patterns) return undefined;

    for (const [framework, pattern] of Object.entries(patterns)) {
      if (pattern.test(content)) {
        return framework;
      }
    }

    return undefined;
  }

  private extractErrorInfo(content: string): { type: string; stackTrace?: string } | null {
    const errorPatterns = [
      /(?:Error|Exception):\s*([^\n]+)/i,
      /(\w+Error):\s*([^\n]+)/i,
      /(\w+Exception):\s*([^\n]+)/i
    ];

    for (const pattern of errorPatterns) {
      const match = content.match(pattern);
      if (match) {
        const stackTraceMatch = content.match(/(?:stack trace|traceback):?\s*([\s\S]+?)(?:\n\n|$)/i);
        return {
          type: match[1].trim(),
          stackTrace: stackTraceMatch ? stackTraceMatch[1].trim() : undefined
        };
      }
    }

    return null;
  }

  private generateTechnicalTags(content: string, metadata: TechnicalMetadata): string[] {
    const tags: Set<string> = new Set();

    // Add language and framework
    if (metadata.language) tags.add(metadata.language);
    if (metadata.framework) tags.add(metadata.framework);
    if (metadata.errorType) tags.add('error');

    // Extract common technical terms
    const techTerms = [
      'api', 'database', 'authentication', 'performance', 'security',
      'testing', 'deployment', 'docker', 'kubernetes', 'aws',
      'algorithm', 'datastructure', 'optimization', 'debugging'
    ];

    const lowerContent = content.toLowerCase();
    for (const term of techTerms) {
      if (lowerContent.includes(term)) {
        tags.add(term);
      }
    }

    return Array.from(tags).slice(0, 10);
  }

  private calculateTechnicalImportance(content: string, metadata: TechnicalMetadata): number {
    let score = 0.5;

    // Solutions are highly important
    if (metadata.solution) score += 0.2;

    // Errors with stack traces are important
    if (metadata.errorType && metadata.stackTrace) score += 0.15;

    // Code snippets add value
    if (metadata.codeSnippet) score += 0.1;

    // Documentation is valuable
    if (metadata.documentationType) score += 0.1;

    // Longer content typically more valuable
    if (content.length > 500) score += 0.05;

    return Math.min(score, 1.0);
  }

  private categorizeTechnical(metadata: TechnicalMetadata): string[] {
    const categories: string[] = [];

    if (metadata.errorType) categories.push('debugging');
    if (metadata.codeSnippet) categories.push('code-examples');
    if (metadata.documentationType) categories.push('documentation');
    if (metadata.solution) categories.push('solutions');
    if (metadata.framework) categories.push(`framework-${metadata.framework}`);
    if (metadata.language) categories.push(`lang-${metadata.language}`);

    return categories;
  }

  private formatCodeSnippet(content: string, snippet: string, language?: string): string {
    const lang = language || 'plaintext';
    return content.replace(snippet, `\n\`\`\`${lang}\n${snippet}\n\`\`\`\n`);
  }
}

export default TechnicalModule;