import { BaseModule, ModuleInfo } from '@/core/modules/base.module';
import { 
  Memory, 
  SearchOptions,
  ModuleStats,
  ModuleConfig,
  ModuleType
} from '@/core/modules/interfaces';
import { PrismaClient } from '@prisma/client';
import { getCMIService } from '@/core/cmi/index.service';

interface PersonalMetadata {
  category?: 'preferences' | 'experiences' | 'beliefs' | 'goals' | 'relationships' | 'habits';
  emotional_valence?: number; // -1 to 1 (negative to positive)
  importance?: number; // 0 to 1
  privacy_level?: 'private' | 'trusted' | 'public';
  related_people?: string[];
  date_context?: string;
  life_period?: string;
  importanceScore?: number;
  categories?: string[];
}

export class PersonalModule extends BaseModule {
  constructor(prisma?: PrismaClient, cmi?: ReturnType<typeof getCMIService>) {
    const config: ModuleConfig = {
      id: 'personal',
      name: 'Personal Memory',
      description: 'Stores personal information, preferences, experiences, and self-knowledge',
      tableName: 'personal_memories',
      maxMemorySize: 10000,
      retentionDays: 365,
      features: {
        emotionalAnalysis: true
      },
      metadata: {
        searchableFields: ['category', 'related_people', 'life_period'],
        requiredFields: [],
        indexedFields: ['category', 'privacy_level']
      }
    };
    
    super(config, prisma, cmi);
  }

  getModuleInfo(): ModuleInfo {
    return {
      name: this.config.name,
      description: this.config.description,
      type: 'standard' as ModuleType
    };
  }

  async processMetadata(content: string, metadata: Record<string, any>): Promise<Record<string, any>> {
    const personalMetadata: PersonalMetadata = {
      ...metadata,
      privacy_level: metadata.privacy_level || 'private'
    };

    // Auto-categorize if not provided
    if (!personalMetadata.category) {
      personalMetadata.category = this.categorizePersonalContent(content);
    }

    // Analyze emotional valence if not provided
    if (personalMetadata.emotional_valence === undefined) {
      personalMetadata.emotional_valence = this.analyzeEmotionalValence(content);
    }

    // Extract related people
    if (!personalMetadata.related_people) {
      personalMetadata.related_people = this.extractPeople(content);
    }

    // Set importance based on content analysis
    if (personalMetadata.importance === undefined) {
      personalMetadata.importance = this.assessImportance(content, personalMetadata);
    }

    // Set importanceScore for CMI
    personalMetadata.importanceScore = personalMetadata.importance;
    
    // Set categories for CMI
    personalMetadata.categories = [personalMetadata.category || 'personal'];

    return personalMetadata;
  }

  formatSearchResult(memory: Memory): Memory {
    const metadata = memory.metadata as PersonalMetadata;
    
    // Add personal context to the memory metadata
    const enrichedMetadata: any = {
      ...metadata,
      contextSummary: []
    };
    
    if (metadata.category) {
      enrichedMetadata.contextSummary.push(`Category: ${metadata.category}`);
    }
    
    if (metadata.emotional_valence !== undefined) {
      const emotion = metadata.emotional_valence > 0.5 ? 'positive' : 
                     metadata.emotional_valence < -0.5 ? 'negative' : 'neutral';
      enrichedMetadata.contextSummary.push(`Emotional tone: ${emotion}`);
    }
    
    if (metadata.related_people && metadata.related_people.length > 0) {
      enrichedMetadata.contextSummary.push(`Related to: ${metadata.related_people.join(', ')}`);
    }
    
    if (metadata.life_period) {
      enrichedMetadata.contextSummary.push(`Period: ${metadata.life_period}`);
    }
    
    return {
      ...memory,
      metadata: enrichedMetadata
    };
  }

  async searchByEmbedding(
    userId: string, 
    embedding: number[], 
    options?: SearchOptions
  ): Promise<Memory[]> {
    const limit = options?.limit || 10;
    const minScore = options?.minScore || 0.5;

    const query = `
      SELECT 
        id,
        "userId",
        content,
        metadata,
        "accessCount",
        "lastAccessed",
        "createdAt",
        "updatedAt",
        1 - (embedding <=> $2::vector) as score
      FROM ${this.config.tableName}
      WHERE "userId" = $1
        AND 1 - (embedding <=> $2::vector) > $3
      ORDER BY score DESC
      LIMIT $4
    `;

    const result = await this.prisma.$queryRawUnsafe<any[]>(
      query,
      userId,
      `[${embedding.join(',')}]`,
      minScore,
      limit
    );

    return result.map(row => ({
      id: row.id,
      userId: row.userId,
      content: row.content,
      metadata: row.metadata,
      accessCount: row.accessCount,
      lastAccessed: row.lastAccessed,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
  }

  protected async storeInModule(
    userId: string,
    content: string,
    embedding: number[],
    metadata: Record<string, any>
  ): Promise<Memory> {
    const id = await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO personal_memories (id, "userId", content, embedding, metadata, "createdAt", "updatedAt", "accessCount", "lastAccessed")
      VALUES (
        gen_random_uuid(),
        ${userId},
        ${content},
        ${`[${embedding.join(',')}]`}::vector,
        ${JSON.stringify(metadata)}::jsonb,
        NOW(),
        NOW(),
        0,
        NOW()
      )
      RETURNING id
    `;

    const result = await this.prisma.personalMemory.findUniqueOrThrow({
      where: { id: id[0].id }
    });

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

  protected async getFromModule(userId: string, memoryId: string): Promise<Memory | null> {
    const result = await this.prisma.personalMemory.findFirst({
      where: {
        id: memoryId,
        userId
      }
    });

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
      const updateData: any = {};
      if (updates.content !== undefined) updateData.content = updates.content;
      // Note: embedding updates would require raw SQL query
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
      
      await this.prisma.personalMemory.update({
        where: {
          id: memoryId
        },
        data: updateData
      });
      
      return true;
    } catch {
      return false;
    }
  }

  protected async deleteFromModule(userId: string, memoryId: string): Promise<boolean> {
    try {
      await this.prisma.personalMemory.delete({
        where: {
          id: memoryId
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  protected async calculateStats(userId: string): Promise<ModuleStats> {
    const memories = await this.prisma.personalMemory.findMany({
      where: { userId }
    });

    const categories: Record<string, number> = {};
    let totalAccessCount = 0;

    for (const memory of memories) {
      const metadata = memory.metadata as PersonalMetadata;
      if (metadata.category) {
        categories[metadata.category] = (categories[metadata.category] || 0) + 1;
      }
      totalAccessCount += memory.accessCount;
    }

    const sortedCategories = Object.entries(categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat]) => cat);

    return {
      totalMemories: memories.length,
      totalSize: memories.reduce((sum, m) => sum + m.content.length, 0),
      lastAccessed: memories.length > 0 
        ? memories.reduce((latest, m) => 
            m.lastAccessed > latest ? m.lastAccessed : latest, 
            memories[0].lastAccessed
          )
        : undefined,
      mostFrequentCategories: sortedCategories,
      averageAccessCount: memories.length > 0 
        ? totalAccessCount / memories.length 
        : 0
    };
  }

  // Helper methods
  private categorizePersonalContent(content: string): PersonalMetadata['category'] {
    const lowerContent = content.toLowerCase();
    
    const categoryKeywords = {
      preferences: ['prefer', 'like', 'enjoy', 'favorite', 'love', 'hate', 'dislike'],
      experiences: ['remember', 'happened', 'went', 'did', 'experienced', 'felt'],
      beliefs: ['believe', 'think', 'opinion', 'value', 'principle', 'faith'],
      goals: ['want', 'goal', 'aspire', 'plan', 'future', 'dream', 'achieve'],
      relationships: ['friend', 'family', 'partner', 'colleague', 'mother', 'father', 'sibling'],
      habits: ['always', 'usually', 'routine', 'daily', 'weekly', 'habit', 'regularly']
    };
    
    let maxScore = 0;
    let bestCategory: PersonalMetadata['category'] = 'experiences';
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const score = keywords.filter(keyword => lowerContent.includes(keyword)).length;
      if (score > maxScore) {
        maxScore = score;
        bestCategory = category as PersonalMetadata['category'];
      }
    }
    
    return bestCategory;
  }

  private analyzeEmotionalValence(content: string): number {
    const lowerContent = content.toLowerCase();
    
    const positiveWords = [
      'happy', 'joy', 'love', 'excited', 'grateful', 'wonderful', 'amazing',
      'fantastic', 'great', 'excellent', 'blessed', 'fortunate', 'proud'
    ];
    
    const negativeWords = [
      'sad', 'angry', 'frustrated', 'disappointed', 'hurt', 'pain', 'terrible',
      'awful', 'horrible', 'depressed', 'anxious', 'worried', 'scared'
    ];
    
    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;
    
    if (positiveCount === 0 && negativeCount === 0) return 0;
    
    const totalCount = positiveCount + negativeCount;
    const valence = (positiveCount - negativeCount) / totalCount;
    
    return Math.max(-1, Math.min(1, valence));
  }

  private extractPeople(content: string): string[] {
    const people: string[] = [];
    
    const relationshipPatterns = [
      /(?:my|our)\s+(\w+)\s+([A-Z][a-z]+)/g,
      /([A-Z][a-z]+)\s+(?:is|was)\s+my\s+\w+/g,
      /(?:friend|colleague|partner)\s+([A-Z][a-z]+)/g
    ];
    
    for (const pattern of relationshipPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const name = match[1] || match[2];
        if (name && !people.includes(name)) {
          people.push(name);
        }
      }
    }
    
    const potentialNames = content.match(/\b[A-Z][a-z]+\b/g) || [];
    const commonWords = ['The', 'This', 'That', 'These', 'Those', 'My', 'Your', 'Our'];
    
    for (const name of potentialNames) {
      if (!commonWords.includes(name) && !people.includes(name)) {
        const nameCount = (content.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
        if (nameCount > 1) {
          people.push(name);
        }
      }
    }
    
    return people.slice(0, 5);
  }

  private assessImportance(content: string, metadata: PersonalMetadata): number {
    let importance = 0.5;
    
    if (metadata.category === 'goals' || metadata.category === 'beliefs') {
      importance += 0.2;
    }
    
    if (Math.abs(metadata.emotional_valence || 0) > 0.5) {
      importance += 0.1;
    }
    
    if (metadata.related_people && metadata.related_people.length > 2) {
      importance += 0.1;
    }
    
    const importanceKeywords = [
      'important', 'significant', 'crucial', 'vital', 'essential',
      'never forget', 'always remember', 'life-changing', 'pivotal'
    ];
    
    const lowerContent = content.toLowerCase();
    const importanceMatches = importanceKeywords.filter(keyword => lowerContent.includes(keyword)).length;
    importance += importanceMatches * 0.1;
    
    return Math.min(1, importance);
  }

  // Additional public methods
  async analyze(userId: string, options?: { timeRange?: string; category?: string }): Promise<any> {
    try {
      const memories = await this.prisma.personalMemory.findMany({
        where: { userId }
      });
      
      const filteredMemories = options?.category
        ? memories.filter(m => (m.metadata as PersonalMetadata).category === options.category)
        : memories;
      
      const analysis = {
        total_memories: filteredMemories.length,
        categories: this.analyzeCategoryDistribution(filteredMemories),
        emotional_summary: this.analyzeEmotionalTrends(filteredMemories),
        important_themes: this.extractImportantThemes(filteredMemories),
        people_network: this.analyzePeopleNetwork(filteredMemories),
        privacy_distribution: this.analyzePrivacyLevels(filteredMemories)
      };
      
      return analysis;
    } catch (error) {
      this.logger.error('Error analyzing personal memories', { error });
      throw error;
    }
  }

  private analyzeCategoryDistribution(memories: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const memory of memories) {
      const category = (memory.metadata as PersonalMetadata).category || 'uncategorized';
      distribution[category] = (distribution[category] || 0) + 1;
    }
    
    return distribution;
  }

  private analyzeEmotionalTrends(memories: any[]): any {
    const withValence = memories.filter(m => 
      (m.metadata as PersonalMetadata).emotional_valence !== undefined
    );
    
    if (withValence.length === 0) {
      return { average_valence: 0, trend: 'neutral' };
    }
    
    const totalValence = withValence.reduce((sum, m) => 
      sum + ((m.metadata as PersonalMetadata).emotional_valence || 0), 0
    );
    
    const avgValence = totalValence / withValence.length;
    
    return {
      average_valence: avgValence,
      trend: avgValence > 0.3 ? 'positive' : avgValence < -0.3 ? 'negative' : 'neutral',
      positive_count: withValence.filter(m => 
        (m.metadata as PersonalMetadata).emotional_valence! > 0.3
      ).length,
      negative_count: withValence.filter(m => 
        (m.metadata as PersonalMetadata).emotional_valence! < -0.3
      ).length
    };
  }

  private extractImportantThemes(memories: any[]): string[] {
    const importantMemories = memories
      .filter(m => (m.metadata as PersonalMetadata).importance! > 0.7)
      .sort((a, b) => 
        ((b.metadata as PersonalMetadata).importance || 0) - 
        ((a.metadata as PersonalMetadata).importance || 0)
      )
      .slice(0, 5);
    
    return importantMemories.map(m => {
      const content = m.content.slice(0, 100);
      return content + (m.content.length > 100 ? '...' : '');
    });
  }

  private analyzePeopleNetwork(memories: any[]): Record<string, number> {
    const peopleCount: Record<string, number> = {};
    
    for (const memory of memories) {
      const people = (memory.metadata as PersonalMetadata).related_people || [];
      for (const person of people) {
        peopleCount[person] = (peopleCount[person] || 0) + 1;
      }
    }
    
    return Object.fromEntries(
      Object.entries(peopleCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
    );
  }

  private analyzePrivacyLevels(memories: any[]): Record<string, number> {
    const levels: Record<string, number> = {
      private: 0,
      trusted: 0,
      public: 0
    };
    
    for (const memory of memories) {
      const privacy = (memory.metadata as PersonalMetadata).privacy_level || 'private';
      levels[privacy]++;
    }
    
    return levels;
  }
}