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

interface CommunicationMetadata {
  category?: 'email' | 'chat' | 'meeting' | 'call' | 'message' | 'discussion' | 'presentation';
  channel?: string; // email, slack, teams, zoom, phone, etc.
  participants?: string[];
  sender?: string;
  recipients?: string[];
  thread_id?: string;
  conversation_topic?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  tone?: 'formal' | 'casual' | 'professional' | 'friendly' | 'urgent';
  key_points?: string[];
  action_items?: string[];
  decisions?: string[];
  questions_raised?: string[];
  follow_up_needed?: boolean;
  response_required?: boolean;
  response_deadline?: string;
  communication_date?: string;
  duration_minutes?: number;
  importance?: 'low' | 'medium' | 'high' | 'critical';
  confidentiality?: 'public' | 'internal' | 'confidential' | 'restricted';
  importanceScore?: number;
  categories?: string[];
}

export class CommunicationModule extends BaseModule {
  constructor(prisma?: PrismaClient, cmi?: ReturnType<typeof getCMIService>) {
    const config: ModuleConfig = {
      id: 'communication',
      name: 'Communication Memory',
      description: 'Manages interpersonal communications, conversations, messages, and collaborative interactions',
      tableName: 'communication_memories',
      maxMemorySize: 10000,
      retentionDays: 365,
      features: {
        threadManagement: true,
        timeBasedRetrieval: true
      },
      metadata: {
        searchableFields: ['category', 'channel', 'participants', 'conversation_topic', 'sender'],
        requiredFields: [],
        indexedFields: ['category', 'channel', 'thread_id', 'sentiment']
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
    const commMetadata: CommunicationMetadata = {
      ...metadata,
      importance: metadata.importance || 'medium'
    };

    // Auto-categorize if not provided
    if (!commMetadata.category) {
      commMetadata.category = this.categorizeCommunication(content);
    }

    // Extract participants if not provided
    if (!commMetadata.participants || commMetadata.participants.length === 0) {
      commMetadata.participants = this.extractParticipants(content);
    }

    // Extract sender if not provided
    if (!commMetadata.sender && commMetadata.participants && commMetadata.participants.length > 0) {
      commMetadata.sender = this.identifySender(content, commMetadata.participants);
    }

    // Analyze sentiment if not provided
    if (!commMetadata.sentiment) {
      commMetadata.sentiment = this.analyzeSentimentContent(content);
    }

    // Determine tone if not provided
    if (!commMetadata.tone) {
      commMetadata.tone = this.analyzeTone(content);
    }

    // Extract key points
    if (!commMetadata.key_points) {
      commMetadata.key_points = this.extractKeyPoints(content);
    }

    // Extract action items
    if (!commMetadata.action_items || commMetadata.action_items.length === 0) {
      commMetadata.action_items = this.extractActionItems(content);
    }

    // Extract questions
    if (!commMetadata.questions_raised) {
      commMetadata.questions_raised = this.extractQuestions(content);
    }

    // Extract decisions
    if (!commMetadata.decisions) {
      commMetadata.decisions = this.extractDecisions(content);
    }

    // Determine if follow-up is needed
    commMetadata.follow_up_needed = this.needsFollowUp(content, commMetadata);

    // Determine if response is required
    commMetadata.response_required = this.needsResponse(content, commMetadata);

    // Extract response deadline if applicable
    if (commMetadata.response_required && !commMetadata.response_deadline) {
      commMetadata.response_deadline = this.extractDeadline(content);
    }

    // Calculate importance score
    commMetadata.importanceScore = this.calculateImportanceScore(commMetadata);
    
    // Set categories for CMI
    commMetadata.categories = ['communication'];
    if (commMetadata.category) {
      commMetadata.categories.push(commMetadata.category);
    }
    if (commMetadata.channel) {
      commMetadata.categories.push(`channel:${commMetadata.channel}`);
    }

    return commMetadata;
  }

  formatSearchResult(memory: Memory): Memory {
    const metadata = memory.metadata as CommunicationMetadata;
    
    const enrichedMetadata: any = {
      ...metadata,
      contextSummary: []
    };
    
    if (metadata.category) {
      enrichedMetadata.contextSummary.push(`Type: ${metadata.category}`);
    }
    
    if (metadata.channel) {
      enrichedMetadata.contextSummary.push(`Channel: ${metadata.channel}`);
    }
    
    if (metadata.participants && metadata.participants.length > 0) {
      const participantList = metadata.participants.slice(0, 3).join(', ');
      const more = metadata.participants.length > 3 ? ` +${metadata.participants.length - 3}` : '';
      enrichedMetadata.contextSummary.push(`With: ${participantList}${more}`);
    }
    
    if (metadata.sentiment) {
      enrichedMetadata.contextSummary.push(`Sentiment: ${metadata.sentiment}`);
    }
    
    if (metadata.response_required) {
      enrichedMetadata.contextSummary.push(`⚡ Response needed`);
      if (metadata.response_deadline) {
        enrichedMetadata.contextSummary.push(`Due: ${metadata.response_deadline}`);
      }
    }
    
    if (metadata.follow_up_needed) {
      enrichedMetadata.contextSummary.push(`📌 Follow-up required`);
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
      INSERT INTO communication_memories (id, "userId", content, embedding, metadata, "createdAt", "updatedAt", "accessCount", "lastAccessed")
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

    const result = await this.prisma.communicationMemory.findUniqueOrThrow({
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
    const result = await this.prisma.communicationMemory.findFirst({
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
      
      await this.prisma.communicationMemory.update({
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
      await this.prisma.communicationMemory.delete({
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
    const memories = await this.prisma.communicationMemory.findMany({
      where: { userId }
    });

    const channels: Record<string, number> = {};
    let totalAccessCount = 0;

    for (const memory of memories) {
      const metadata = memory.metadata as CommunicationMetadata;
      if (metadata.channel) {
        channels[metadata.channel] = (channels[metadata.channel] || 0) + 1;
      }
      totalAccessCount += memory.accessCount;
    }

    const topChannels = Object.entries(channels)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([channel]) => channel);

    return {
      totalMemories: memories.length,
      totalSize: memories.reduce((sum, m) => sum + m.content.length, 0),
      lastAccessed: memories.length > 0 
        ? memories.reduce((latest, m) => 
            m.lastAccessed > latest ? m.lastAccessed : latest, 
            memories[0].lastAccessed
          )
        : undefined,
      mostFrequentCategories: topChannels,
      averageAccessCount: memories.length > 0 
        ? totalAccessCount / memories.length 
        : 0
    };
  }

  // Helper methods
  private categorizeCommunication(content: string): CommunicationMetadata['category'] {
    const lowerContent = content.toLowerCase();
    
    const categoryKeywords = {
      email: ['email', 'subject:', 'dear', 'regards', 'sincerely', 'attachment'],
      chat: ['chat', 'dm', 'direct message', 'ping', 'hey', 'hi'],
      meeting: ['meeting', 'agenda', 'minutes', 'attendees', 'action items', 'discussed'],
      call: ['call', 'phone', 'spoke', 'conversation', 'talked', 'dialed'],
      message: ['message', 'msg', 'text', 'sms', 'whatsapp'],
      discussion: ['discussion', 'thread', 'forum', 'topic', 'debate'],
      presentation: ['presentation', 'slides', 'demo', 'presented', 'audience']
    };
    
    let maxScore = 0;
    let bestCategory: CommunicationMetadata['category'] = 'message';
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const score = keywords.filter(keyword => lowerContent.includes(keyword)).length;
      if (score > maxScore) {
        maxScore = score;
        bestCategory = category as CommunicationMetadata['category'];
      }
    }
    
    return bestCategory;
  }

  private extractParticipants(content: string): string[] {
    const participants: string[] = [];
    
    // Email patterns
    const emailMatches = content.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/g) || [];
    participants.push(...emailMatches);
    
    // @mentions
    const mentionMatches = content.match(/@([a-zA-Z]+(?:\.[a-zA-Z]+)?)/g) || [];
    participants.push(...mentionMatches.map(m => m.substring(1)));
    
    // Names after common phrases
    const namePatterns = [
      /(?:from|to|cc|with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:said|wrote|mentioned|asked)/g
    ];
    
    for (const pattern of namePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const name = match[1].trim();
        if (name && !participants.includes(name)) {
          participants.push(name);
        }
      }
    }
    
    // Remove duplicates and limit
    return [...new Set(participants)]
      .filter(p => p.length > 2)
      .slice(0, 20);
  }

  private identifySender(content: string, participants: string[]): string | undefined {
    const lowerContent = content.toLowerCase();
    
    // Look for explicit sender patterns
    const senderPatterns = [
      /^from:\s*(.+?)$/m,
      /^sender:\s*(.+?)$/m,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+wrote:/,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+said:/
    ];
    
    for (const pattern of senderPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // First person indicators suggest the user is the sender
    if (/\b(I|me|my|mine)\b/.test(content) && participants.length > 0) {
      return 'User';
    }
    
    return participants.length > 0 ? participants[0] : undefined;
  }

  private analyzeSentimentContent(content: string): CommunicationMetadata['sentiment'] {
    const lowerContent = content.toLowerCase();
    
    const positiveWords = [
      'thank', 'thanks', 'appreciate', 'great', 'excellent', 'wonderful',
      'happy', 'pleased', 'excited', 'congratulations', 'well done', 'perfect'
    ];
    
    const negativeWords = [
      'sorry', 'apologize', 'unfortunately', 'problem', 'issue', 'concern',
      'disappointed', 'frustrated', 'unhappy', 'complaint', 'angry', 'upset'
    ];
    
    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;
    
    if (positiveCount > 0 && negativeCount > 0) {
      return 'mixed';
    } else if (positiveCount > negativeCount) {
      return 'positive';
    } else if (negativeCount > positiveCount) {
      return 'negative';
    }
    
    return 'neutral';
  }

  private analyzeTone(content: string): CommunicationMetadata['tone'] {
    const lowerContent = content.toLowerCase();
    
    // Formal indicators
    if (/dear|sincerely|regards|hereby|pursuant|accordance/.test(lowerContent)) {
      return 'formal';
    }
    
    // Urgent indicators
    if (/urgent|asap|immediately|critical|emergency/.test(lowerContent)) {
      return 'urgent';
    }
    
    // Casual indicators
    if (/hey|hi|lol|haha|btw|fyi|thx/.test(lowerContent)) {
      return 'casual';
    }
    
    // Friendly indicators
    if (/hope you|how are|have a great|looking forward|cheers/.test(lowerContent)) {
      return 'friendly';
    }
    
    return 'professional';
  }

  private extractKeyPoints(content: string): string[] {
    const keyPoints: string[] = [];
    
    // Look for bullet points or numbered lists
    const listPatterns = [
      /^[\s]*[-*•]\s+(.+?)$/gm,
      /^\d+[.)]\s+(.+?)$/gm
    ];
    
    for (const pattern of listPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        keyPoints.push(match[1].trim());
      }
    }
    
    // Look for key phrases
    const keyPhrasePatterns = [
      /(?:key point|important|note that|please note|remember):\s*(.+?)(?:\.|;|\n|$)/gi,
      /(?:main|primary|essential)\s+(?:point|topic|issue):\s*(.+?)(?:\.|;|\n|$)/gi
    ];
    
    for (const pattern of keyPhrasePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        keyPoints.push(match[1].trim());
      }
    }
    
    return [...new Set(keyPoints)].slice(0, 10);
  }

  private extractActionItems(content: string): string[] {
    const actionItems: string[] = [];
    
    // Action item patterns
    const actionPatterns = [
      /(?:action item|todo|task|will|should|need to|must):\s*(.+?)(?:\.|;|\n|$)/gi,
      /(?:please|kindly|could you)\s+(.+?)(?:\.|;|\n|$)/gi,
      /(?:I'll|I will|you'll|you will)\s+(.+?)(?:\.|;|\n|$)/gi
    ];
    
    for (const pattern of actionPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const item = match[1].trim();
        if (item.length > 10 && item.length < 200) {
          actionItems.push(item);
        }
      }
    }
    
    return [...new Set(actionItems)].slice(0, 10);
  }

  private extractQuestions(content: string): string[] {
    const questions: string[] = [];
    
    // Direct questions
    const questionMatches = content.match(/[^.!?]+\?/g) || [];
    questions.push(...questionMatches.map(q => q.trim()));
    
    // Indirect questions
    const indirectPatterns = [
      /(?:wondering|curious|question is|wanted to know)\s+(.+?)(?:\.|;|\n|$)/gi,
      /(?:could you|can you|would you)\s+(.+?)(?:\.|;|\n|$)/gi
    ];
    
    for (const pattern of indirectPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        questions.push(match[0].trim());
      }
    }
    
    return [...new Set(questions)].slice(0, 10);
  }

  private extractDecisions(content: string): string[] {
    const decisions: string[] = [];
    
    // Decision patterns
    const decisionPatterns = [
      /(?:decided|agreed|concluded|resolved)\s+(?:to|that)\s+(.+?)(?:\.|;|\n|$)/gi,
      /(?:decision|agreement|conclusion):\s*(.+?)(?:\.|;|\n|$)/gi,
      /(?:we will|it was|has been)\s+(?:decided|agreed)\s+(.+?)(?:\.|;|\n|$)/gi
    ];
    
    for (const pattern of decisionPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        decisions.push(match[1].trim());
      }
    }
    
    return [...new Set(decisions)].slice(0, 10);
  }

  private needsFollowUp(content: string, metadata: CommunicationMetadata): boolean {
    const lowerContent = content.toLowerCase();
    
    // Explicit follow-up indicators
    if (/follow.?up|revisit|check back|circle back|touch base/.test(lowerContent)) {
      return true;
    }
    
    // Has unanswered questions
    if (metadata.questions_raised && metadata.questions_raised.length > 0) {
      return true;
    }
    
    // Has action items
    if (metadata.action_items && metadata.action_items.length > 0) {
      return true;
    }
    
    return false;
  }

  private needsResponse(content: string, metadata: CommunicationMetadata): boolean {
    const lowerContent = content.toLowerCase();
    
    // Direct response indicators
    if (/please\s+(reply|respond|answer|let\s+me\s+know)|waiting\s+for\s+your|need\s+your\s+(input|feedback|response)/.test(lowerContent)) {
      return true;
    }
    
    // Questions directed at user
    if (metadata.questions_raised && metadata.questions_raised.length > 0) {
      return true;
    }
    
    // Urgent tone
    if (metadata.tone === 'urgent') {
      return true;
    }
    
    return false;
  }

  private extractDeadline(content: string): string | undefined {
    const datePatterns = [
      /(?:by|before|until|deadline|due)\s+(?:is\s+)?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
      /(?:by|before|until|deadline|due)\s+(?:is\s+)?(monday|tuesday|wednesday|thursday|friday|end of day|eod|cob)/i,
      /(?:within|in)\s+(\d+)\s+(hours?|days?|weeks?)/i,
      /(?:respond|reply)\s+by\s+(.+?)(?:\.|,|\n|$)/i
    ];
    
    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return undefined;
  }

  private calculateImportanceScore(metadata: CommunicationMetadata): number {
    let score = 0.5; // baseline
    
    // Importance level contribution
    const importanceScores = {
      low: 0,
      medium: 0.2,
      high: 0.3,
      critical: 0.4
    };
    score += importanceScores[metadata.importance || 'medium'];
    
    // Response required adds importance
    if (metadata.response_required) {
      score += 0.1;
    }
    
    // Follow-up needed adds importance
    if (metadata.follow_up_needed) {
      score += 0.05;
    }
    
    // Decisions made are important
    if (metadata.decisions && metadata.decisions.length > 0) {
      score += 0.1;
    }
    
    // Many participants indicates importance
    if (metadata.participants && metadata.participants.length > 5) {
      score += 0.05;
    }
    
    return Math.min(1, score);
  }

  // Additional public methods
  async analyze(userId: string, options?: { 
    channel?: string;
    category?: string;
    participant?: string;
    sentiment?: string;
    needsResponse?: boolean;
  }): Promise<any> {
    try {
      const memories = await this.prisma.communicationMemory.findMany({
        where: { userId }
      });
      
      let filteredMemories = memories;
      
      // Apply filters
      if (options?.channel) {
        filteredMemories = filteredMemories.filter(m => 
          (m.metadata as CommunicationMetadata).channel === options.channel
        );
      }
      if (options?.category) {
        filteredMemories = filteredMemories.filter(m => 
          (m.metadata as CommunicationMetadata).category === options.category
        );
      }
      if (options?.participant) {
        filteredMemories = filteredMemories.filter(m => 
          (m.metadata as CommunicationMetadata).participants?.includes(options.participant!)
        );
      }
      if (options?.sentiment) {
        filteredMemories = filteredMemories.filter(m => 
          (m.metadata as CommunicationMetadata).sentiment === options.sentiment
        );
      }
      if (options?.needsResponse) {
        filteredMemories = filteredMemories.filter(m => 
          (m.metadata as CommunicationMetadata).response_required === true
        );
      }
      
      const analysis = {
        total_communications: filteredMemories.length,
        channels: this.analyzeChannels(filteredMemories),
        participants_network: this.analyzeParticipantsNetwork(filteredMemories),
        sentiment_summary: this.analyzeSentimentDistribution(filteredMemories),
        tone_distribution: this.analyzeToneDistribution(filteredMemories),
        active_threads: this.getActiveThreads(filteredMemories),
        pending_responses: this.getPendingResponses(filteredMemories),
        follow_ups_needed: this.getFollowUps(filteredMemories),
        key_decisions: this.getKeyDecisions(filteredMemories),
        communication_patterns: this.analyzeCommunicationPatterns(filteredMemories),
        response_time_analysis: this.analyzeResponseTimes(filteredMemories)
      };
      
      return analysis;
    } catch (error) {
      this.logger.error('Error analyzing communication memories', { error });
      throw error;
    }
  }

  private analyzeChannels(memories: any[]): Record<string, {
    count: number;
    sentiment: Record<string, number>;
  }> {
    const channels: Record<string, any> = {};
    
    for (const memory of memories) {
      const metadata = memory.metadata as CommunicationMetadata;
      const channel = metadata.channel || 'unknown';
      
      if (!channels[channel]) {
        channels[channel] = {
          count: 0,
          sentiment: { positive: 0, neutral: 0, negative: 0, mixed: 0 }
        };
      }
      
      channels[channel].count++;
      const sentiment = metadata.sentiment || 'neutral';
      channels[channel].sentiment[sentiment]++;
    }
    
    return channels;
  }

  private analyzeParticipantsNetwork(memories: any[]): Array<{
    participant: string;
    interactions: number;
    channels: string[];
    sentiment: Record<string, number>;
  }> {
    const participantMap: Record<string, any> = {};
    
    for (const memory of memories) {
      const metadata = memory.metadata as CommunicationMetadata;
      const participants = metadata.participants || [];
      
      for (const participant of participants) {
        if (!participantMap[participant]) {
          participantMap[participant] = {
            participant,
            interactions: 0,
            channels: new Set<string>(),
            sentiment: { positive: 0, neutral: 0, negative: 0, mixed: 0 }
          };
        }
        
        participantMap[participant].interactions++;
        if (metadata.channel) {
          participantMap[participant].channels.add(metadata.channel);
        }
        const sentiment = metadata.sentiment || 'neutral';
        participantMap[participant].sentiment[sentiment]++;
      }
    }
    
    return Object.values(participantMap)
      .map(p => ({
        participant: p.participant,
        interactions: p.interactions,
        channels: Array.from(p.channels) as string[],
        sentiment: p.sentiment
      }))
      .sort((a, b) => b.interactions - a.interactions)
      .slice(0, 20);
  }

  private analyzeSentimentDistribution(memories: any[]): Record<string, number> {
    const sentiment: Record<string, number> = {
      positive: 0,
      neutral: 0,
      negative: 0,
      mixed: 0
    };
    
    for (const memory of memories) {
      const s = (memory.metadata as CommunicationMetadata).sentiment || 'neutral';
      sentiment[s]++;
    }
    
    return sentiment;
  }

  private analyzeToneDistribution(memories: any[]): Record<string, number> {
    const tones: Record<string, number> = {
      formal: 0,
      casual: 0,
      professional: 0,
      friendly: 0,
      urgent: 0
    };
    
    for (const memory of memories) {
      const tone = (memory.metadata as CommunicationMetadata).tone || 'professional';
      tones[tone]++;
    }
    
    return tones;
  }

  private getActiveThreads(memories: any[]): Array<{
    threadId: string;
    topic: string;
    participantCount: number;
    lastActivity: Date;
    messageCount: number;
  }> {
    const threadMap: Record<string, any> = {};
    
    for (const memory of memories) {
      const metadata = memory.metadata as CommunicationMetadata;
      const threadId = metadata.thread_id;
      
      if (threadId) {
        if (!threadMap[threadId]) {
          threadMap[threadId] = {
            threadId,
            topic: metadata.conversation_topic || 'Untitled Thread',
            participants: new Set<string>(),
            lastActivity: memory.updatedAt,
            messageCount: 0
          };
        }
        
        threadMap[threadId].messageCount++;
        if (metadata.participants) {
          metadata.participants.forEach(p => threadMap[threadId].participants.add(p));
        }
        if (memory.updatedAt > threadMap[threadId].lastActivity) {
          threadMap[threadId].lastActivity = memory.updatedAt;
        }
      }
    }
    
    return Object.values(threadMap)
      .map(t => ({
        threadId: t.threadId,
        topic: t.topic,
        participantCount: t.participants.size,
        lastActivity: t.lastActivity,
        messageCount: t.messageCount
      }))
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
      .slice(0, 10);
  }

  private getPendingResponses(memories: any[]): Array<{
    content: string;
    from: string;
    deadline?: string;
    channel?: string;
    age: number;
  }> {
    const now = new Date();
    
    return memories
      .filter(m => (m.metadata as CommunicationMetadata).response_required)
      .map(m => {
        const metadata = m.metadata as CommunicationMetadata;
        const ageInDays = Math.floor((now.getTime() - m.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          content: m.content.substring(0, 100) + '...',
          from: metadata.sender || 'Unknown',
          deadline: metadata.response_deadline,
          channel: metadata.channel,
          age: ageInDays
        };
      })
      .sort((a, b) => b.age - a.age)
      .slice(0, 10);
  }

  private getFollowUps(memories: any[]): Array<{
    content: string;
    participants: string[];
    topic?: string;
    createdAt: Date;
  }> {
    return memories
      .filter(m => (m.metadata as CommunicationMetadata).follow_up_needed)
      .map(m => ({
        content: m.content.substring(0, 100) + '...',
        participants: (m.metadata as CommunicationMetadata).participants || [],
        topic: (m.metadata as CommunicationMetadata).conversation_topic,
        createdAt: m.createdAt
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);
  }

  private getKeyDecisions(memories: any[]): string[] {
    const decisions: string[] = [];
    
    for (const memory of memories) {
      const metadata = memory.metadata as CommunicationMetadata;
      if (metadata.decisions) {
        decisions.push(...metadata.decisions);
      }
    }
    
    return [...new Set(decisions)].slice(0, 20);
  }

  private analyzeCommunicationPatterns(memories: any[]): {
    mostActiveHours: Record<number, number>;
    mostActiveDays: Record<string, number>;
    averageResponseLength: number;
  } {
    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<string, number> = {};
    let totalLength = 0;
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (const memory of memories) {
      const date = new Date(memory.createdAt);
      const hour = date.getHours();
      const day = days[date.getDay()];
      
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      dayCounts[day] = (dayCounts[day] || 0) + 1;
      totalLength += memory.content.length;
    }
    
    return {
      mostActiveHours: hourCounts,
      mostActiveDays: dayCounts,
      averageResponseLength: memories.length > 0 ? totalLength / memories.length : 0
    };
  }

  private analyzeResponseTimes(memories: any[]): {
    averageResponseTime?: number;
    fastestResponse?: number;
    slowestResponse?: number;
  } {
    // This is a simplified analysis - in a real system you'd track actual response times
    const threadResponses: Record<string, Date[]> = {};
    
    for (const memory of memories) {
      const metadata = memory.metadata as CommunicationMetadata;
      if (metadata.thread_id) {
        if (!threadResponses[metadata.thread_id]) {
          threadResponses[metadata.thread_id] = [];
        }
        threadResponses[metadata.thread_id].push(memory.createdAt);
      }
    }
    
    const responseTimes: number[] = [];
    
    for (const times of Object.values(threadResponses)) {
      if (times.length > 1) {
        times.sort((a, b) => a.getTime() - b.getTime());
        for (let i = 1; i < times.length; i++) {
          const responseTime = times[i].getTime() - times[i-1].getTime();
          responseTimes.push(responseTime);
        }
      }
    }
    
    if (responseTimes.length === 0) {
      return {};
    }
    
    const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    return {
      averageResponseTime: avgTime / (1000 * 60), // Convert to minutes
      fastestResponse: Math.min(...responseTimes) / (1000 * 60),
      slowestResponse: Math.max(...responseTimes) / (1000 * 60)
    };
  }
}