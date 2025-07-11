import { BaseModule, ModuleInfo } from '@/core/modules/base.module';
import {
  Memory,
  SearchOptions,
  ModuleStats,
  ModuleConfig,
  ModuleType,
} from '@/core/modules/interfaces';
import { PrismaClient } from '@prisma/client';
import { getCMIService } from '@/core/cmi/index.service';

interface LearningMetadata {
  category?: 'concept' | 'tutorial' | 'reference' | 'practice' | 'reflection' | 'question';
  subject?: string;
  topics?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  progress?: 'not_started' | 'in_progress' | 'completed' | 'mastered';
  understanding_level?: number; // 0-1 scale
  resource_type?:
    | 'article'
    | 'video'
    | 'book'
    | 'course'
    | 'documentation'
    | 'example'
    | 'exercise';
  resource_url?: string;
  prerequisites?: string[];
  related_concepts?: string[];
  practice_exercises?: string[];
  key_takeaways?: string[];
  questions?: string[];
  time_spent_minutes?: number;
  review_needed?: boolean;
  last_reviewed?: string;
  importanceScore?: number;
  categories?: string[];
}

export class LearningModule extends BaseModule {
  constructor(prisma?: PrismaClient, cmi?: ReturnType<typeof getCMIService>) {
    const config: ModuleConfig = {
      id: 'learning',
      name: 'Learning Memory',
      description: 'Tracks learning progress, concepts, resources, and knowledge connections',
      tableName: 'learning_memories',
      maxMemorySize: 10000,
      retentionDays: -1, // Never expire learning memories
      features: {
        timeBasedRetrieval: true,
      },
      metadata: {
        searchableFields: ['category', 'subject', 'topics', 'difficulty', 'progress'],
        requiredFields: [],
        indexedFields: ['category', 'subject', 'progress', 'difficulty'],
      },
    };

    super(config, prisma, cmi);
  }

  getModuleInfo(): ModuleInfo {
    return {
      name: this.config.name,
      description: this.config.description,
      type: 'standard' as ModuleType,
    };
  }

  async processMetadata(
    content: string,
    metadata: Record<string, any>,
  ): Promise<Record<string, any>> {
    const learningMetadata: LearningMetadata = {
      ...metadata,
      progress: metadata.progress || 'not_started',
    };

    // Auto-categorize if not provided
    if (!learningMetadata.category) {
      learningMetadata.category = this.categorizeLearningContent(content);
    }

    // Extract subject if not provided
    if (!learningMetadata.subject) {
      learningMetadata.subject = this.extractSubject(content);
    }

    // Extract topics
    if (!learningMetadata.topics || learningMetadata.topics.length === 0) {
      learningMetadata.topics = this.extractTopics(content);
    }

    // Assess difficulty if not provided
    if (!learningMetadata.difficulty) {
      learningMetadata.difficulty = this.assessDifficulty(content, learningMetadata);
    }

    // Extract related concepts
    if (!learningMetadata.related_concepts) {
      learningMetadata.related_concepts = this.extractRelatedConcepts(content);
    }

    // Extract questions
    if (learningMetadata.category === 'question' || content.includes('?')) {
      if (!learningMetadata.questions) {
        learningMetadata.questions = this.extractQuestions(content);
      }
    }

    // Extract key takeaways
    if (!learningMetadata.key_takeaways) {
      learningMetadata.key_takeaways = this.extractKeyTakeaways(content);
    }

    // Set understanding level based on progress and category
    if (learningMetadata.understanding_level === undefined) {
      learningMetadata.understanding_level = this.assessUnderstandingLevel(learningMetadata);
    }

    // Set review needed flag
    learningMetadata.review_needed = this.shouldReview(learningMetadata);

    // Calculate importance score
    learningMetadata.importanceScore = this.calculateImportanceScore(learningMetadata);

    // Set categories for CMI
    learningMetadata.categories = ['learning'];
    if (learningMetadata.subject) {
      learningMetadata.categories.push(`subject:${learningMetadata.subject}`);
    }
    if (learningMetadata.category) {
      learningMetadata.categories.push(learningMetadata.category);
    }

    return learningMetadata;
  }

  formatSearchResult(memory: Memory): Memory {
    const metadata = memory.metadata as LearningMetadata;

    const enrichedMetadata: any = {
      ...metadata,
      contextSummary: [],
    };

    if (metadata.subject) {
      enrichedMetadata.contextSummary.push(`Subject: ${metadata.subject}`);
    }

    if (metadata.category) {
      enrichedMetadata.contextSummary.push(`Type: ${metadata.category}`);
    }

    if (metadata.difficulty) {
      enrichedMetadata.contextSummary.push(`Level: ${metadata.difficulty}`);
    }

    if (metadata.progress) {
      enrichedMetadata.contextSummary.push(`Progress: ${metadata.progress}`);
    }

    if (metadata.understanding_level !== undefined) {
      const percentage = Math.round(metadata.understanding_level * 100);
      enrichedMetadata.contextSummary.push(`Understanding: ${percentage}%`);
    }

    if (metadata.review_needed) {
      enrichedMetadata.contextSummary.push(`📌 Review needed`);
    }

    return {
      ...memory,
      metadata: enrichedMetadata,
    };
  }

  async searchByEmbedding(
    userId: string,
    embedding: number[],
    options?: SearchOptions,
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
      limit,
    );

    return result.map(row => ({
      id: row.id,
      userId: row.userId,
      content: row.content,
      metadata: row.metadata,
      accessCount: row.accessCount,
      lastAccessed: row.lastAccessed,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  protected async storeInModule(
    userId: string,
    content: string,
    embedding: number[],
    metadata: Record<string, any>,
  ): Promise<Memory> {
    const id = await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO learning_memories (id, "userId", content, embedding, metadata, "createdAt", "updatedAt", "accessCount", "lastAccessed")
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

    const result = await this.prisma.learningMemory.findUniqueOrThrow({
      where: { id: id[0].id },
    });

    return {
      id: result.id,
      userId: result.userId,
      content: result.content,
      metadata: result.metadata as Record<string, any>,
      accessCount: result.accessCount,
      lastAccessed: result.lastAccessed,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  protected async getFromModule(userId: string, memoryId: string): Promise<Memory | null> {
    const result = await this.prisma.learningMemory.findFirst({
      where: {
        id: memoryId,
        userId,
      },
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
      updatedAt: result.updatedAt,
    };
  }

  protected async updateInModule(
    userId: string,
    memoryId: string,
    updates: Partial<Memory>,
  ): Promise<boolean> {
    try {
      const updateData: any = {};
      if (updates.content !== undefined) updateData.content = updates.content;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

      await this.prisma.learningMemory.update({
        where: {
          id: memoryId,
        },
        data: updateData,
      });

      return true;
    } catch {
      return false;
    }
  }

  protected async deleteFromModule(userId: string, memoryId: string): Promise<boolean> {
    try {
      await this.prisma.learningMemory.delete({
        where: {
          id: memoryId,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  protected async calculateStats(userId: string): Promise<ModuleStats> {
    const memories = await this.prisma.learningMemory.findMany({
      where: { userId },
    });

    const subjects: Record<string, number> = {};
    let totalAccessCount = 0;

    for (const memory of memories) {
      const metadata = memory.metadata as LearningMetadata;
      if (metadata.subject) {
        subjects[metadata.subject] = (subjects[metadata.subject] || 0) + 1;
      }
      totalAccessCount += memory.accessCount;
    }

    const topSubjects = Object.entries(subjects)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([subject]) => subject);

    return {
      totalMemories: memories.length,
      totalSize: memories.reduce((sum, m) => sum + m.content.length, 0),
      lastAccessed:
        memories.length > 0
          ? memories.reduce(
              (latest, m) => (m.lastAccessed > latest ? m.lastAccessed : latest),
              memories[0].lastAccessed,
            )
          : undefined,
      mostFrequentCategories: topSubjects,
      averageAccessCount: memories.length > 0 ? totalAccessCount / memories.length : 0,
    };
  }

  // Helper methods
  private categorizeLearningContent(content: string): LearningMetadata['category'] {
    const lowerContent = content.toLowerCase();

    const categoryKeywords = {
      concept: ['concept', 'theory', 'principle', 'fundamental', 'definition', 'explanation'],
      tutorial: ['tutorial', 'how to', 'guide', 'step by step', 'walkthrough', 'example'],
      reference: ['reference', 'documentation', 'api', 'syntax', 'specification', 'manual'],
      practice: ['practice', 'exercise', 'problem', 'challenge', 'implement', 'solve'],
      reflection: ['learned', 'understand', 'realize', 'insight', 'reflection', 'conclusion'],
      question: ['?', 'why', 'how', 'what', 'when', 'where', 'question', 'wondering'],
    };

    let maxScore = 0;
    let bestCategory: LearningMetadata['category'] = 'concept';

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const score = keywords.filter(keyword => lowerContent.includes(keyword)).length;
      if (score > maxScore) {
        maxScore = score;
        bestCategory = category as LearningMetadata['category'];
      }
    }

    return bestCategory;
  }

  private extractSubject(content: string): string | undefined {
    // Look for subject patterns
    const subjectPatterns = [
      /(?:learning|studying|about|regarding)\s+([A-Za-z\s]+?)(?:\.|,|\n|$)/i,
      /^([A-Z][A-Za-z\s]+?)(?:\s*[-:]\s*)/,
      /(?:subject|topic):\s*([A-Za-z\s]+?)(?:\.|,|\n|$)/i,
    ];

    for (const pattern of subjectPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Extract from technical terms
    const technicalTerms = content.match(
      /\b(?:JavaScript|Python|React|Node\.js|TypeScript|SQL|Docker|Kubernetes|AWS|Machine Learning|AI|Data Science|Algorithms|Design Patterns)\b/gi,
    );
    if (technicalTerms && technicalTerms.length > 0) {
      return technicalTerms[0];
    }

    return undefined;
  }

  private extractTopics(content: string): string[] {
    const topics: string[] = [];

    // Technical topics
    const techTopics = content.match(/\b(?:[A-Z][a-z]+(?:[A-Z][a-z]+)*|[A-Z]{2,})\b/g) || [];
    topics.push(...techTopics.filter(t => t.length > 2 && t.length < 30));

    // Concepts after "about", "regarding", etc.
    const conceptMatches =
      content.match(/(?:about|regarding|concerning|including)\s+([a-z]+(?:\s+[a-z]+)?)/gi) || [];
    conceptMatches.forEach(match => {
      const concept = match.replace(/^(?:about|regarding|concerning|including)\s+/i, '');
      if (concept && !topics.includes(concept)) {
        topics.push(concept);
      }
    });

    // Remove duplicates and common words
    const commonWords = ['The', 'This', 'That', 'These', 'Those', 'And', 'But', 'For'];
    return [...new Set(topics)].filter(topic => !commonWords.includes(topic)).slice(0, 10);
  }

  private assessDifficulty(
    content: string,
    metadata: LearningMetadata,
  ): LearningMetadata['difficulty'] {
    const lowerContent = content.toLowerCase();

    // Beginner indicators
    if (/beginner|basic|intro|fundamentals|getting started|simple/.test(lowerContent)) {
      return 'beginner';
    }

    // Advanced/Expert indicators
    if (
      /advanced|expert|complex|sophisticated|optimization|architecture|design patterns/.test(
        lowerContent,
      )
    ) {
      return metadata.topics && metadata.topics.length > 5 ? 'expert' : 'advanced';
    }

    // Intermediate indicators
    if (/intermediate|practical|implementation|building|creating/.test(lowerContent)) {
      return 'intermediate';
    }

    // Based on content complexity
    const codeBlocks = (content.match(/```/g) || []).length / 2;
    const technicalTerms = (content.match(/\b[A-Z]{2,}\b/g) || []).length;

    if (codeBlocks > 3 || technicalTerms > 10) {
      return 'advanced';
    } else if (codeBlocks > 1 || technicalTerms > 5) {
      return 'intermediate';
    }

    return 'beginner';
  }

  private extractRelatedConcepts(content: string): string[] {
    const concepts: string[] = [];

    // Look for "related to", "similar to", "like", etc.
    const relationPatterns = [
      /(?:related to|similar to|like|such as|including)\s+([A-Za-z\s,]+?)(?:\.|;|\n|$)/gi,
      /(?:compare|versus|vs\.?)\s+([A-Za-z\s]+?)(?:\.|;|\n|and|$)/gi,
    ];

    for (const pattern of relationPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const items = match[1].split(/,|and/).map(item => item.trim());
        concepts.push(...items.filter(item => item.length > 2));
      }
    }

    return [...new Set(concepts)].slice(0, 10);
  }

  private extractQuestions(content: string): string[] {
    const questions: string[] = [];

    // Extract sentences ending with ?
    const questionMatches = content.match(/[^.!?]+\?/g) || [];
    questions.push(...questionMatches.map(q => q.trim()));

    // Extract implicit questions
    const implicitPatterns = [
      /(?:wondering|curious|need to know|want to understand)\s+(.+?)(?:\.|;|\n|$)/gi,
      /(?:how|why|what|when|where)\s+(?:does|do|is|are|can|should)\s+(.+?)(?:\.|;|\n|$)/gi,
    ];

    for (const pattern of implicitPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        questions.push(match[0].trim());
      }
    }

    return [...new Set(questions)].slice(0, 10);
  }

  private extractKeyTakeaways(content: string): string[] {
    const takeaways: string[] = [];

    // Look for explicit takeaways
    const takeawayPatterns = [
      /(?:key takeaway|important|remember|note):\s*(.+?)(?:\.|;|\n|$)/gi,
      /(?:learned that|discovered that|found that)\s+(.+?)(?:\.|;|\n|$)/gi,
      /(?:conclusion|summary):\s*(.+?)(?:\.|;|\n|$)/gi,
    ];

    for (const pattern of takeawayPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        takeaways.push(match[1].trim());
      }
    }

    // Look for bullet points or numbered lists
    const listItems = content.match(/^[\s]*[-*•]\s+(.+?)$/gm) || [];
    takeaways.push(...listItems.map(item => item.replace(/^[\s]*[-*•]\s+/, '').trim()));

    return [...new Set(takeaways)].slice(0, 10);
  }

  private assessUnderstandingLevel(metadata: LearningMetadata): number {
    let level = 0.3; // baseline

    // Progress contribution
    const progressLevels = {
      not_started: 0,
      in_progress: 0.3,
      completed: 0.6,
      mastered: 0.9,
    };
    level = progressLevels[metadata.progress || 'not_started'];

    // Category adjustments
    if (metadata.category === 'practice' && metadata.progress === 'completed') {
      level += 0.1;
    }
    if (metadata.category === 'reflection') {
      level += 0.1;
    }

    // Time spent factor
    if (metadata.time_spent_minutes) {
      if (metadata.time_spent_minutes > 60) level += 0.1;
      if (metadata.time_spent_minutes > 180) level += 0.1;
    }

    return Math.min(1, level);
  }

  private shouldReview(metadata: LearningMetadata): boolean {
    // Always review if explicitly marked
    if (metadata.review_needed) return true;

    // Review questions
    if (metadata.category === 'question' && metadata.progress !== 'completed') {
      return true;
    }

    // Review incomplete advanced topics
    if (metadata.difficulty === 'advanced' && metadata.progress === 'in_progress') {
      return true;
    }

    // Review if understanding is low
    if (metadata.understanding_level !== undefined && metadata.understanding_level < 0.5) {
      return true;
    }

    return false;
  }

  private calculateImportanceScore(metadata: LearningMetadata): number {
    let score = 0.5; // baseline

    // Difficulty contribution
    const difficultyScores = {
      beginner: 0.1,
      intermediate: 0.2,
      advanced: 0.3,
      expert: 0.4,
    };
    score += difficultyScores[metadata.difficulty || 'beginner'];

    // Progress weight (incomplete advanced topics are important)
    if (metadata.progress === 'in_progress') {
      score += 0.1;
    }

    // Questions are important
    if (metadata.category === 'question') {
      score += 0.1;
    }

    // Prerequisites make it foundational
    if (metadata.prerequisites && metadata.prerequisites.length > 0) {
      score += 0.05;
    }

    return Math.min(1, score);
  }

  // Additional public methods
  async analyze(
    userId: string,
    options?: {
      subject?: string;
      category?: string;
      difficulty?: string;
      needsReview?: boolean;
    },
  ): Promise<any> {
    try {
      const memories = await this.prisma.learningMemory.findMany({
        where: { userId },
      });

      let filteredMemories = memories;

      // Apply filters
      if (options?.subject) {
        filteredMemories = filteredMemories.filter(
          m => (m.metadata as LearningMetadata).subject === options.subject,
        );
      }
      if (options?.category) {
        filteredMemories = filteredMemories.filter(
          m => (m.metadata as LearningMetadata).category === options.category,
        );
      }
      if (options?.difficulty) {
        filteredMemories = filteredMemories.filter(
          m => (m.metadata as LearningMetadata).difficulty === options.difficulty,
        );
      }
      if (options?.needsReview) {
        filteredMemories = filteredMemories.filter(
          m => (m.metadata as LearningMetadata).review_needed === true,
        );
      }

      const analysis = {
        total_memories: filteredMemories.length,
        subjects: this.analyzeSubjects(filteredMemories),
        progress_summary: this.analyzeProgress(filteredMemories),
        difficulty_distribution: this.analyzeDifficulty(filteredMemories),
        understanding_overview: this.analyzeUnderstanding(filteredMemories),
        topics_network: this.analyzeTopicsNetwork(filteredMemories),
        learning_path: this.suggestLearningPath(filteredMemories),
        questions_pending: this.getPendingQuestions(filteredMemories),
        review_items: this.getReviewItems(filteredMemories),
        time_investment: this.analyzeTimeInvestment(filteredMemories),
      };

      return analysis;
    } catch (error) {
      this.logger.error('Error analyzing learning memories', { error });
      throw error;
    }
  }

  private analyzeSubjects(memories: any[]): Record<
    string,
    {
      count: number;
      averageUnderstanding: number;
      progress: Record<string, number>;
    }
  > {
    const subjects: Record<string, any> = {};

    for (const memory of memories) {
      const metadata = memory.metadata as LearningMetadata;
      const subject = metadata.subject || 'General';

      if (!subjects[subject]) {
        subjects[subject] = {
          count: 0,
          totalUnderstanding: 0,
          progress: {
            not_started: 0,
            in_progress: 0,
            completed: 0,
            mastered: 0,
          },
        };
      }

      subjects[subject].count++;
      subjects[subject].totalUnderstanding += metadata.understanding_level || 0;
      subjects[subject].progress[metadata.progress || 'not_started']++;
    }

    // Calculate averages
    const result: Record<string, any> = {};
    for (const [subject, data] of Object.entries(subjects)) {
      result[subject] = {
        count: data.count,
        averageUnderstanding: data.count > 0 ? data.totalUnderstanding / data.count : 0,
        progress: data.progress,
      };
    }

    return result;
  }

  private analyzeProgress(memories: any[]): Record<string, number> {
    const progress: Record<string, number> = {
      not_started: 0,
      in_progress: 0,
      completed: 0,
      mastered: 0,
    };

    for (const memory of memories) {
      const status = (memory.metadata as LearningMetadata).progress || 'not_started';
      progress[status]++;
    }

    return progress;
  }

  private analyzeDifficulty(memories: any[]): Record<string, number> {
    const difficulty: Record<string, number> = {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
      expert: 0,
    };

    for (const memory of memories) {
      const level = (memory.metadata as LearningMetadata).difficulty || 'beginner';
      difficulty[level]++;
    }

    return difficulty;
  }

  private analyzeUnderstanding(memories: any[]): {
    average: number;
    distribution: Record<string, number>;
  } {
    let total = 0;
    let count = 0;
    const distribution: Record<string, number> = {
      low: 0, // 0-0.3
      medium: 0, // 0.3-0.7
      high: 0, // 0.7-1.0
    };

    for (const memory of memories) {
      const level = (memory.metadata as LearningMetadata).understanding_level;
      if (level !== undefined) {
        total += level;
        count++;

        if (level < 0.3) distribution.low++;
        else if (level < 0.7) distribution.medium++;
        else distribution.high++;
      }
    }

    return {
      average: count > 0 ? total / count : 0,
      distribution,
    };
  }

  private analyzeTopicsNetwork(memories: any[]): Record<string, number> {
    const topicsCount: Record<string, number> = {};

    for (const memory of memories) {
      const topics = (memory.metadata as LearningMetadata).topics || [];
      for (const topic of topics) {
        topicsCount[topic] = (topicsCount[topic] || 0) + 1;
      }
    }

    return Object.fromEntries(
      Object.entries(topicsCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20),
    );
  }

  private suggestLearningPath(memories: any[]): Array<{
    subject: string;
    nextSteps: string[];
    prerequisites: string[];
  }> {
    const subjectMap: Record<string, any> = {};

    for (const memory of memories) {
      const metadata = memory.metadata as LearningMetadata;
      const subject = metadata.subject;

      if (subject && metadata.progress === 'in_progress') {
        if (!subjectMap[subject]) {
          subjectMap[subject] = {
            subject: subject,
            concepts: new Set<string>(),
            prerequisites: new Set<string>(),
          };
        }

        if (metadata.related_concepts) {
          metadata.related_concepts.forEach(c => subjectMap[subject].concepts.add(c));
        }
        if (metadata.prerequisites) {
          metadata.prerequisites.forEach(p => subjectMap[subject].prerequisites.add(p));
        }
      }
    }

    return Object.values(subjectMap)
      .map(item => ({
        subject: item.subject as string,
        nextSteps: Array.from(item.concepts as Set<string>).slice(0, 5),
        prerequisites: Array.from(item.prerequisites as Set<string>).slice(0, 5),
      }))
      .slice(0, 5);
  }

  private getPendingQuestions(memories: any[]): string[] {
    return memories
      .filter(m => {
        const metadata = m.metadata as LearningMetadata;
        return metadata.category === 'question' && metadata.progress !== 'completed';
      })
      .map(m => m.content.substring(0, 100) + '...')
      .slice(0, 10);
  }

  private getReviewItems(memories: any[]): Array<{
    content: string;
    subject?: string;
    lastReviewed?: string;
    understanding: number;
  }> {
    return memories
      .filter(m => (m.metadata as LearningMetadata).review_needed)
      .map(m => ({
        content: m.content.substring(0, 100) + '...',
        subject: (m.metadata as LearningMetadata).subject,
        lastReviewed: (m.metadata as LearningMetadata).last_reviewed,
        understanding: (m.metadata as LearningMetadata).understanding_level || 0,
      }))
      .sort((a, b) => a.understanding - b.understanding)
      .slice(0, 10);
  }

  private analyzeTimeInvestment(memories: any[]): {
    totalMinutes: number;
    bySubject: Record<string, number>;
    byCategory: Record<string, number>;
  } {
    let totalMinutes = 0;
    const bySubject: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const memory of memories) {
      const metadata = memory.metadata as LearningMetadata;
      const time = metadata.time_spent_minutes || 0;
      totalMinutes += time;

      if (metadata.subject) {
        bySubject[metadata.subject] = (bySubject[metadata.subject] || 0) + time;
      }

      if (metadata.category) {
        byCategory[metadata.category] = (byCategory[metadata.category] || 0) + time;
      }
    }

    return {
      totalMinutes,
      bySubject,
      byCategory,
    };
  }
}
