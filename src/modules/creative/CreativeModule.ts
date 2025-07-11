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

interface CreativeMetadata {
  category?: 'idea' | 'story' | 'design' | 'music' | 'art' | 'writing' | 'brainstorm' | 'concept';
  medium?: string; // text, visual, audio, video, mixed
  genre?: string; // fiction, poetry, technical, business, personal, etc.
  style?: string; // minimalist, detailed, abstract, realistic, etc.
  mood?: string; // inspiring, melancholic, energetic, calm, etc.
  themes?: string[];
  tags?: string[];
  inspiration_sources?: string[];
  collaborators?: string[];
  stage?: 'ideation' | 'draft' | 'revision' | 'final' | 'published' | 'archived';
  quality_score?: number; // 0-1 self-assessment
  originality_score?: number; // 0-1 how unique/novel
  completion_percentage?: number; // 0-100
  tools_used?: string[];
  techniques?: string[];
  target_audience?: string;
  purpose?: string;
  related_works?: string[];
  iterations?: number;
  creation_date?: string;
  last_modified?: string;
  public_visibility?: 'private' | 'shared' | 'public';
  license?: string;
  importanceScore?: number;
  categories?: string[];
}

export class CreativeModule extends BaseModule {
  constructor(prisma?: PrismaClient, cmi?: ReturnType<typeof getCMIService>) {
    const config: ModuleConfig = {
      id: 'creative',
      name: 'Creative Memory',
      description: 'Stores creative works, ideas, artistic content, and imaginative projects',
      tableName: 'creative_memories',
      maxMemorySize: 50000, // Larger size for creative content
      retentionDays: -1, // Never expire creative works
      features: {
        timeBasedRetrieval: true
      },
      metadata: {
        searchableFields: ['category', 'medium', 'genre', 'themes', 'tags', 'stage'],
        requiredFields: [],
        indexedFields: ['category', 'medium', 'stage', 'public_visibility']
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
    const creativeMetadata: CreativeMetadata = {
      ...metadata,
      stage: metadata.stage || 'ideation',
      public_visibility: metadata.public_visibility || 'private'
    };

    // Auto-categorize if not provided
    if (!creativeMetadata.category) {
      creativeMetadata.category = this.categorizeCreativeWork(content);
    }

    // Detect medium if not provided
    if (!creativeMetadata.medium) {
      creativeMetadata.medium = this.detectMedium(content, creativeMetadata);
    }

    // Extract themes if not provided
    if (!creativeMetadata.themes || creativeMetadata.themes.length === 0) {
      creativeMetadata.themes = this.extractThemes(content);
    }

    // Extract tags
    if (!creativeMetadata.tags || creativeMetadata.tags.length === 0) {
      creativeMetadata.tags = this.extractTags(content);
    }

    // Analyze mood if not provided
    if (!creativeMetadata.mood) {
      creativeMetadata.mood = this.analyzeMood(content);
    }

    // Detect techniques used
    if (!creativeMetadata.techniques) {
      creativeMetadata.techniques = this.detectTechniques(content, creativeMetadata);
    }

    // Assess quality if not provided
    if (creativeMetadata.quality_score === undefined) {
      creativeMetadata.quality_score = this.assessQuality(content, creativeMetadata);
    }

    // Assess originality if not provided
    if (creativeMetadata.originality_score === undefined) {
      creativeMetadata.originality_score = this.assessOriginality(content, creativeMetadata);
    }

    // Calculate completion percentage if not provided
    if (creativeMetadata.completion_percentage === undefined) {
      creativeMetadata.completion_percentage = this.calculateCompletion(content, creativeMetadata);
    }

    // Set creation date if new
    if (!creativeMetadata.creation_date) {
      creativeMetadata.creation_date = new Date().toISOString();
    }

    // Update last modified
    creativeMetadata.last_modified = new Date().toISOString();

    // Increment iterations
    creativeMetadata.iterations = (creativeMetadata.iterations || 0) + 1;

    // Calculate importance score
    creativeMetadata.importanceScore = this.calculateImportanceScore(creativeMetadata);
    
    // Set categories for CMI
    creativeMetadata.categories = ['creative'];
    if (creativeMetadata.category) {
      creativeMetadata.categories.push(creativeMetadata.category);
    }
    if (creativeMetadata.medium) {
      creativeMetadata.categories.push(`medium:${creativeMetadata.medium}`);
    }
    if (creativeMetadata.stage) {
      creativeMetadata.categories.push(`stage:${creativeMetadata.stage}`);
    }

    return creativeMetadata;
  }

  formatSearchResult(memory: Memory): Memory {
    const metadata = memory.metadata as CreativeMetadata;
    
    const enrichedMetadata: any = {
      ...metadata,
      contextSummary: []
    };
    
    if (metadata.category) {
      enrichedMetadata.contextSummary.push(`Type: ${metadata.category}`);
    }
    
    if (metadata.medium) {
      enrichedMetadata.contextSummary.push(`Medium: ${metadata.medium}`);
    }
    
    if (metadata.stage) {
      enrichedMetadata.contextSummary.push(`Stage: ${metadata.stage}`);
    }
    
    if (metadata.completion_percentage !== undefined) {
      enrichedMetadata.contextSummary.push(`${metadata.completion_percentage}% complete`);
    }
    
    if (metadata.quality_score !== undefined) {
      const stars = '★'.repeat(Math.round(metadata.quality_score * 5));
      enrichedMetadata.contextSummary.push(stars);
    }
    
    if (metadata.themes && metadata.themes.length > 0) {
      enrichedMetadata.contextSummary.push(`Themes: ${metadata.themes.slice(0, 3).join(', ')}`);
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
      INSERT INTO creative_memories (id, "userId", content, embedding, metadata, "createdAt", "updatedAt", "accessCount", "lastAccessed")
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

    const result = await this.prisma.creativeMemory.findUniqueOrThrow({
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
    const result = await this.prisma.creativeMemory.findFirst({
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
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
      
      await this.prisma.creativeMemory.update({
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
      await this.prisma.creativeMemory.delete({
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
    const memories = await this.prisma.creativeMemory.findMany({
      where: { userId }
    });

    const categories: Record<string, number> = {};
    let totalAccessCount = 0;

    for (const memory of memories) {
      const metadata = memory.metadata as CreativeMetadata;
      if (metadata.category) {
        categories[metadata.category] = (categories[metadata.category] || 0) + 1;
      }
      totalAccessCount += memory.accessCount;
    }

    const topCategories = Object.entries(categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category]) => category);

    return {
      totalMemories: memories.length,
      totalSize: memories.reduce((sum, m) => sum + m.content.length, 0),
      lastAccessed: memories.length > 0 
        ? memories.reduce((latest, m) => 
            m.lastAccessed > latest ? m.lastAccessed : latest, 
            memories[0].lastAccessed
          )
        : undefined,
      mostFrequentCategories: topCategories,
      averageAccessCount: memories.length > 0 
        ? totalAccessCount / memories.length 
        : 0
    };
  }

  // Helper methods
  private categorizeCreativeWork(content: string): CreativeMetadata['category'] {
    const lowerContent = content.toLowerCase();
    
    const categoryKeywords = {
      idea: ['idea', 'concept', 'brainstorm', 'what if', 'imagine', 'possibility'],
      story: ['story', 'narrative', 'plot', 'character', 'scene', 'dialogue', 'chapter'],
      design: ['design', 'layout', 'color', 'typography', 'interface', 'mockup', 'wireframe'],
      music: ['melody', 'rhythm', 'chord', 'song', 'composition', 'beat', 'harmony'],
      art: ['painting', 'drawing', 'sketch', 'sculpture', 'illustration', 'artwork'],
      writing: ['essay', 'article', 'blog', 'draft', 'manuscript', 'prose', 'verse'],
      brainstorm: ['brainstorm', 'ideas', 'thoughts', 'possibilities', 'options', 'alternatives'],
      concept: ['concept', 'framework', 'model', 'theory', 'approach', 'methodology']
    };
    
    let maxScore = 0;
    let bestCategory: CreativeMetadata['category'] = 'idea';
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const score = keywords.filter(keyword => lowerContent.includes(keyword)).length;
      if (score > maxScore) {
        maxScore = score;
        bestCategory = category as CreativeMetadata['category'];
      }
    }
    
    return bestCategory;
  }

  private detectMedium(content: string, metadata: CreativeMetadata): string {
    // Check for code blocks (text-based creative coding)
    if (content.includes('```') || content.includes('function') || content.includes('class')) {
      return 'code';
    }
    
    // Check for markdown/rich text
    if (content.includes('#') || content.includes('**') || content.includes('![')) {
      return 'text';
    }
    
    // Check for links to media
    if (/\.(jpg|png|gif|svg|mp3|wav|mp4|mov)/i.test(content)) {
      return 'mixed';
    }
    
    // Default based on category
    const categoryDefaults: Record<string, string> = {
      story: 'text',
      design: 'visual',
      music: 'audio',
      art: 'visual',
      writing: 'text'
    };
    
    return categoryDefaults[metadata.category || ''] || 'text';
  }

  private extractThemes(content: string): string[] {
    const themes: string[] = [];
    
    // Common creative themes
    const themePatterns = [
      { pattern: /(?:about|exploring|theme of|deals with)\s+([a-z\s]+?)(?:\.|,|\n|$)/gi, group: 1 },
      { pattern: /(?:love|friendship|betrayal|redemption|growth|identity|freedom|power|nature|technology|humanity)/gi, group: 0 },
      { pattern: /(?:journey|transformation|conflict|discovery|creation|destruction)/gi, group: 0 }
    ];
    
    for (const { pattern, group } of themePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const theme = group === 0 ? match[0] : match[1];
        if (theme && theme.length > 2 && theme.length < 50) {
          themes.push(theme.toLowerCase().trim());
        }
      }
    }
    
    return [...new Set(themes)].slice(0, 10);
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];
    
    // Look for hashtags
    const hashtagMatches = content.match(/#[a-zA-Z]\w*/g) || [];
    tags.push(...hashtagMatches.map(tag => tag.substring(1).toLowerCase()));
    
    // Look for keywords in brackets or parentheses
    const bracketMatches = content.match(/\[([^\]]+)\]/g) || [];
    const parenMatches = content.match(/\(([^)]+)\)/g) || [];
    
    [...bracketMatches, ...parenMatches].forEach(match => {
      const tag = match.slice(1, -1).trim();
      if (tag.length > 2 && tag.length < 30 && !tag.includes(' ')) {
        tags.push(tag.toLowerCase());
      }
    });
    
    // Extract significant nouns
    const significantWords = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    tags.push(...significantWords.filter(word => 
      word.length > 3 && 
      !['The', 'This', 'That', 'These', 'Those'].includes(word)
    ).map(w => w.toLowerCase()));
    
    return [...new Set(tags)].slice(0, 20);
  }

  private analyzeMood(content: string): string {
    const lowerContent = content.toLowerCase();
    
    const moodIndicators = {
      inspiring: ['inspire', 'motivate', 'uplift', 'encourage', 'empower', 'hope'],
      melancholic: ['sad', 'melancholy', 'nostalgic', 'longing', 'bittersweet', 'wistful'],
      energetic: ['energy', 'vibrant', 'dynamic', 'exciting', 'fast', 'intense', 'action'],
      calm: ['calm', 'peaceful', 'serene', 'tranquil', 'gentle', 'quiet', 'still'],
      mysterious: ['mystery', 'enigma', 'unknown', 'secret', 'hidden', 'shadow'],
      whimsical: ['whimsy', 'playful', 'fun', 'silly', 'quirky', 'lighthearted'],
      dark: ['dark', 'grim', 'ominous', 'sinister', 'haunting', 'eerie'],
      romantic: ['love', 'romance', 'passion', 'tender', 'intimate', 'heart']
    };
    
    let maxScore = 0;
    let dominantMood = 'neutral';
    
    for (const [mood, keywords] of Object.entries(moodIndicators)) {
      const score = keywords.filter(keyword => lowerContent.includes(keyword)).length;
      if (score > maxScore) {
        maxScore = score;
        dominantMood = mood;
      }
    }
    
    return dominantMood;
  }

  private detectTechniques(content: string, metadata: CreativeMetadata): string[] {
    const techniques: string[] = [];
    const lowerContent = content.toLowerCase();
    
    // Literary techniques
    if (metadata.category === 'story' || metadata.category === 'writing') {
      const literaryTechniques = [
        'metaphor', 'simile', 'alliteration', 'personification', 
        'imagery', 'symbolism', 'irony', 'foreshadowing'
      ];
      techniques.push(...literaryTechniques.filter(t => lowerContent.includes(t)));
    }
    
    // Design techniques
    if (metadata.category === 'design' || metadata.medium === 'visual') {
      const designTechniques = [
        'grid', 'balance', 'contrast', 'hierarchy', 
        'whitespace', 'color theory', 'typography'
      ];
      techniques.push(...designTechniques.filter(t => lowerContent.includes(t)));
    }
    
    // General creative techniques
    const generalTechniques = [
      'brainstorming', 'mind mapping', 'iteration', 'prototyping',
      'collaboration', 'experimentation', 'research'
    ];
    techniques.push(...generalTechniques.filter(t => lowerContent.includes(t)));
    
    return [...new Set(techniques)].slice(0, 10);
  }

  private assessQuality(content: string, metadata: CreativeMetadata): number {
    let score = 0.5; // baseline
    
    // Length and detail
    if (content.length > 500) score += 0.1;
    if (content.length > 1500) score += 0.1;
    
    // Structure indicators
    if (content.includes('\n\n')) score += 0.05; // Paragraphs
    if (/^#{1,6}\s/m.test(content)) score += 0.05; // Headers
    
    // Completion stage bonus
    const stageScores: Record<string, number> = {
      ideation: 0,
      draft: 0.1,
      revision: 0.2,
      final: 0.3,
      published: 0.4,
      archived: 0.4
    };
    const stage = metadata.stage || 'ideation';
    score += stageScores[stage] || 0;
    
    // Rich metadata bonus
    if (metadata.themes && metadata.themes.length > 3) score += 0.05;
    if (metadata.techniques && metadata.techniques.length > 2) score += 0.05;
    
    return Math.min(1, score);
  }

  private assessOriginality(content: string, metadata: CreativeMetadata): number {
    let score = 0.6; // baseline assumption of some originality
    
    // Unique combinations of themes
    if (metadata.themes && metadata.themes.length > 4) {
      score += 0.1;
    }
    
    // Mixed media or unusual medium
    if (metadata.medium === 'mixed' || metadata.medium === 'experimental') {
      score += 0.1;
    }
    
    // Presence of "new", "novel", "original", "unique" in content
    const originalityWords = ['new', 'novel', 'original', 'unique', 'innovative', 'experimental'];
    const matches = originalityWords.filter(word => 
      content.toLowerCase().includes(word)
    ).length;
    score += matches * 0.05;
    
    // Genre-bending indicators
    if (metadata.genre && metadata.genre.includes('/')) {
      score += 0.1; // hybrid genres
    }
    
    return Math.min(1, score);
  }

  private calculateCompletion(content: string, metadata: CreativeMetadata): number {
    // Stage-based completion
    const stageCompletion: Record<string, number> = {
      ideation: 10,
      draft: 30,
      revision: 60,
      final: 90,
      published: 100,
      archived: 100
    };
    
    const stage = metadata.stage || 'ideation';
    let completion = stageCompletion[stage] || 0;
    
    // Adjust based on content indicators
    if (content.includes('[TODO]') || content.includes('[WIP]')) {
      completion = Math.max(0, completion - 20);
    }
    
    if (content.includes('[DONE]') || content.includes('[COMPLETE]')) {
      completion = Math.min(100, completion + 20);
    }
    
    // Placeholder detection
    if (content.includes('...') || content.includes('TBD')) {
      completion = Math.max(0, completion - 10);
    }
    
    return completion;
  }

  private calculateImportanceScore(metadata: CreativeMetadata): number {
    let score = 0.5; // baseline
    
    // Quality contributes to importance
    score += (metadata.quality_score || 0) * 0.2;
    
    // Originality contributes to importance
    score += (metadata.originality_score || 0) * 0.1;
    
    // Completion status
    if (metadata.stage === 'final' || metadata.stage === 'published') {
      score += 0.2;
    }
    
    // Public visibility indicates importance
    if (metadata.public_visibility === 'public') {
      score += 0.1;
    }
    
    // Collaboration indicates importance
    if (metadata.collaborators && metadata.collaborators.length > 0) {
      score += 0.1;
    }
    
    return Math.min(1, score);
  }

  // Additional public methods
  async analyze(userId: string, options?: { 
    category?: string;
    medium?: string;
    stage?: string;
    minQuality?: number;
  }): Promise<any> {
    try {
      const memories = await this.prisma.creativeMemory.findMany({
        where: { userId }
      });
      
      let filteredMemories = memories;
      
      // Apply filters
      if (options?.category) {
        filteredMemories = filteredMemories.filter(m => 
          (m.metadata as CreativeMetadata).category === options.category
        );
      }
      if (options?.medium) {
        filteredMemories = filteredMemories.filter(m => 
          (m.metadata as CreativeMetadata).medium === options.medium
        );
      }
      if (options?.stage) {
        filteredMemories = filteredMemories.filter(m => 
          (m.metadata as CreativeMetadata).stage === options.stage
        );
      }
      if (options?.minQuality !== undefined) {
        filteredMemories = filteredMemories.filter(m => 
          (m.metadata as CreativeMetadata).quality_score! >= options.minQuality!
        );
      }
      
      const analysis = {
        total_works: filteredMemories.length,
        categories_distribution: this.analyzeCategories(filteredMemories),
        media_types: this.analyzeMedia(filteredMemories),
        stage_distribution: this.analyzeStages(filteredMemories),
        quality_overview: this.analyzeQuality(filteredMemories),
        originality_overview: this.analyzeOriginality(filteredMemories),
        themes_cloud: this.analyzeThemes(filteredMemories),
        mood_palette: this.analyzeMoods(filteredMemories),
        creative_velocity: this.analyzeCreativeVelocity(filteredMemories),
        collaboration_network: this.analyzeCollaborations(filteredMemories),
        completion_rates: this.analyzeCompletionRates(filteredMemories),
        top_works: this.getTopWorks(filteredMemories)
      };
      
      return analysis;
    } catch (error) {
      this.logger.error('Error analyzing creative memories', { error });
      throw error;
    }
  }

  private analyzeCategories(memories: any[]): Record<string, number> {
    const categories: Record<string, number> = {};
    
    for (const memory of memories) {
      const category = (memory.metadata as CreativeMetadata).category || 'uncategorized';
      categories[category] = (categories[category] || 0) + 1;
    }
    
    return categories;
  }

  private analyzeMedia(memories: any[]): Record<string, number> {
    const media: Record<string, number> = {};
    
    for (const memory of memories) {
      const medium = (memory.metadata as CreativeMetadata).medium || 'unknown';
      media[medium] = (media[medium] || 0) + 1;
    }
    
    return media;
  }

  private analyzeStages(memories: any[]): Record<string, number> {
    const stages: Record<string, number> = {};
    
    for (const memory of memories) {
      const stage = (memory.metadata as CreativeMetadata).stage || 'ideation';
      stages[stage] = (stages[stage] || 0) + 1;
    }
    
    return stages;
  }

  private analyzeQuality(memories: any[]): {
    average: number;
    distribution: Record<string, number>;
    highQuality: number;
  } {
    let total = 0;
    let count = 0;
    const distribution: Record<string, number> = {
      low: 0,      // 0-0.3
      medium: 0,   // 0.3-0.7
      high: 0      // 0.7-1.0
    };
    
    for (const memory of memories) {
      const quality = (memory.metadata as CreativeMetadata).quality_score;
      if (quality !== undefined) {
        total += quality;
        count++;
        
        if (quality < 0.3) distribution.low++;
        else if (quality < 0.7) distribution.medium++;
        else distribution.high++;
      }
    }
    
    return {
      average: count > 0 ? total / count : 0,
      distribution,
      highQuality: distribution.high
    };
  }

  private analyzeOriginality(memories: any[]): {
    average: number;
    mostOriginal: Array<{ content: string; score: number }>;
  } {
    let total = 0;
    let count = 0;
    const originals: Array<{ content: string; score: number }> = [];
    
    for (const memory of memories) {
      const originality = (memory.metadata as CreativeMetadata).originality_score;
      if (originality !== undefined) {
        total += originality;
        count++;
        
        if (originality > 0.8) {
          originals.push({
            content: memory.content.substring(0, 100) + '...',
            score: originality
          });
        }
      }
    }
    
    return {
      average: count > 0 ? total / count : 0,
      mostOriginal: originals
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
    };
  }

  private analyzeThemes(memories: any[]): Record<string, number> {
    const themesCount: Record<string, number> = {};
    
    for (const memory of memories) {
      const themes = (memory.metadata as CreativeMetadata).themes || [];
      for (const theme of themes) {
        themesCount[theme] = (themesCount[theme] || 0) + 1;
      }
    }
    
    return Object.fromEntries(
      Object.entries(themesCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
    );
  }

  private analyzeMoods(memories: any[]): Record<string, number> {
    const moods: Record<string, number> = {};
    
    for (const memory of memories) {
      const mood = (memory.metadata as CreativeMetadata).mood || 'neutral';
      moods[mood] = (moods[mood] || 0) + 1;
    }
    
    return moods;
  }

  private analyzeCreativeVelocity(memories: any[]): {
    worksPerMonth: Record<string, number>;
    averageIterations: number;
    completionTime: number; // average days from creation to final
  } {
    const monthCounts: Record<string, number> = {};
    let totalIterations = 0;
    let iterationCount = 0;
    const completionTimes: number[] = [];
    
    for (const memory of memories) {
      const metadata = memory.metadata as CreativeMetadata;
      
      // Count by month
      if (metadata.creation_date) {
        const month = metadata.creation_date.substring(0, 7); // YYYY-MM
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      }
      
      // Track iterations
      if (metadata.iterations) {
        totalIterations += metadata.iterations;
        iterationCount++;
      }
      
      // Calculate completion time
      if (metadata.creation_date && metadata.stage === 'final' && metadata.last_modified) {
        const created = new Date(metadata.creation_date);
        const completed = new Date(metadata.last_modified);
        const days = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        completionTimes.push(days);
      }
    }
    
    return {
      worksPerMonth: monthCounts,
      averageIterations: iterationCount > 0 ? totalIterations / iterationCount : 0,
      completionTime: completionTimes.length > 0 
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length 
        : 0
    };
  }

  private analyzeCollaborations(memories: any[]): Array<{
    collaborator: string;
    projectCount: number;
    categories: string[];
  }> {
    const collabMap: Record<string, any> = {};
    
    for (const memory of memories) {
      const metadata = memory.metadata as CreativeMetadata;
      const collaborators = metadata.collaborators || [];
      
      for (const collaborator of collaborators) {
        if (!collabMap[collaborator]) {
          collabMap[collaborator] = {
            collaborator,
            projectCount: 0,
            categories: new Set<string>()
          };
        }
        
        collabMap[collaborator].projectCount++;
        if (metadata.category) {
          collabMap[collaborator].categories.add(metadata.category);
        }
      }
    }
    
    return Object.values(collabMap)
      .map(c => ({
        collaborator: c.collaborator,
        projectCount: c.projectCount,
        categories: Array.from(c.categories) as string[]
      }))
      .sort((a, b) => b.projectCount - a.projectCount)
      .slice(0, 10);
  }

  private analyzeCompletionRates(memories: any[]): {
    overall: number;
    byCategory: Record<string, number>;
    byMedium: Record<string, number>;
  } {
    const completed = memories.filter(m => 
      (m.metadata as CreativeMetadata).stage === 'final' || 
      (m.metadata as CreativeMetadata).stage === 'published'
    ).length;
    
    const byCategory: Record<string, { total: number; completed: number }> = {};
    const byMedium: Record<string, { total: number; completed: number }> = {};
    
    for (const memory of memories) {
      const metadata = memory.metadata as CreativeMetadata;
      const isCompleted = metadata.stage === 'final' || metadata.stage === 'published';
      
      // By category
      const category = metadata.category || 'uncategorized';
      if (!byCategory[category]) {
        byCategory[category] = { total: 0, completed: 0 };
      }
      byCategory[category].total++;
      if (isCompleted) byCategory[category].completed++;
      
      // By medium
      const medium = metadata.medium || 'unknown';
      if (!byMedium[medium]) {
        byMedium[medium] = { total: 0, completed: 0 };
      }
      byMedium[medium].total++;
      if (isCompleted) byMedium[medium].completed++;
    }
    
    // Calculate rates
    const categoryRates: Record<string, number> = {};
    for (const [cat, data] of Object.entries(byCategory)) {
      categoryRates[cat] = data.total > 0 ? data.completed / data.total : 0;
    }
    
    const mediumRates: Record<string, number> = {};
    for (const [med, data] of Object.entries(byMedium)) {
      mediumRates[med] = data.total > 0 ? data.completed / data.total : 0;
    }
    
    return {
      overall: memories.length > 0 ? completed / memories.length : 0,
      byCategory: categoryRates,
      byMedium: mediumRates
    };
  }

  private getTopWorks(memories: any[]): Array<{
    content: string;
    category?: string;
    qualityScore?: number;
    originalityScore?: number;
    stage?: string;
  }> {
    return memories
      .filter(m => {
        const metadata = m.metadata as CreativeMetadata;
        return metadata.quality_score !== undefined && metadata.quality_score > 0.7;
      })
      .sort((a, b) => {
        const aScore = (a.metadata as CreativeMetadata).quality_score || 0;
        const bScore = (b.metadata as CreativeMetadata).quality_score || 0;
        return bScore - aScore;
      })
      .slice(0, 10)
      .map(m => ({
        content: m.content.substring(0, 150) + '...',
        category: (m.metadata as CreativeMetadata).category,
        qualityScore: (m.metadata as CreativeMetadata).quality_score,
        originalityScore: (m.metadata as CreativeMetadata).originality_score,
        stage: (m.metadata as CreativeMetadata).stage
      }));
  }
}