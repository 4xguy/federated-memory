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

interface WorkMetadata {
  category?: 'project' | 'meeting' | 'task' | 'documentation' | 'communication' | 'planning';
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  status?: 'active' | 'completed' | 'blocked' | 'archived' | 'in_progress';
  project_name?: string;
  team_members?: string[];
  deadline?: string;
  tags?: string[];
  completion_percentage?: number;
  department?: string;
  meeting_type?: 'standup' | 'planning' | 'review' | 'one-on-one' | 'all-hands';
  action_items?: string[];
  dependencies?: string[];
  importanceScore?: number;
  categories?: string[];
}

export class WorkModule extends BaseModule {
  constructor(prisma?: PrismaClient, cmi?: ReturnType<typeof getCMIService>) {
    const config: ModuleConfig = {
      id: 'work',
      name: 'Work Memory',
      description: 'Manages work-related information including projects, tasks, meetings, and professional activities',
      tableName: 'work_memories',
      maxMemorySize: 10000,
      retentionDays: 365,
      features: {
        timeBasedRetrieval: true
      },
      metadata: {
        searchableFields: ['category', 'project_name', 'status', 'priority', 'tags'],
        requiredFields: [],
        indexedFields: ['category', 'status', 'priority', 'project_name']
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
    const workMetadata: WorkMetadata = {
      ...metadata,
      status: metadata.status || 'active'
    };

    // Auto-categorize if not provided
    if (!workMetadata.category) {
      workMetadata.category = this.categorizeWorkContent(content);
    }

    // Extract project name if not provided
    if (!workMetadata.project_name) {
      workMetadata.project_name = this.extractProjectName(content);
    }

    // Extract team members
    if (!workMetadata.team_members) {
      workMetadata.team_members = this.extractTeamMembers(content);
    }

    // Extract deadline
    if (!workMetadata.deadline) {
      workMetadata.deadline = this.extractDeadline(content);
    }

    // Auto-assign priority based on content if not provided
    if (!workMetadata.priority) {
      workMetadata.priority = this.assessPriority(content, workMetadata);
    }

    // Extract action items for meetings
    if (workMetadata.category === 'meeting' && !workMetadata.action_items) {
      workMetadata.action_items = this.extractActionItems(content);
    }

    // Extract tags from content
    if (!workMetadata.tags || workMetadata.tags.length === 0) {
      workMetadata.tags = this.extractTags(content);
    }

    // Set importance score based on priority and deadline
    workMetadata.importanceScore = this.calculateImportanceScore(workMetadata);
    
    // Set categories for CMI
    workMetadata.categories = [workMetadata.category || 'work'];
    if (workMetadata.project_name) {
      workMetadata.categories.push(`project:${workMetadata.project_name}`);
    }

    return workMetadata;
  }

  formatSearchResult(memory: Memory): Memory {
    const metadata = memory.metadata as WorkMetadata;
    
    const enrichedMetadata: any = {
      ...metadata,
      contextSummary: []
    };
    
    if (metadata.category) {
      enrichedMetadata.contextSummary.push(`Type: ${metadata.category}`);
    }
    
    if (metadata.priority) {
      enrichedMetadata.contextSummary.push(`Priority: ${metadata.priority}`);
    }
    
    if (metadata.status) {
      enrichedMetadata.contextSummary.push(`Status: ${metadata.status}`);
    }
    
    if (metadata.project_name) {
      enrichedMetadata.contextSummary.push(`Project: ${metadata.project_name}`);
    }
    
    if (metadata.deadline) {
      enrichedMetadata.contextSummary.push(`Due: ${metadata.deadline}`);
    }
    
    if (metadata.team_members && metadata.team_members.length > 0) {
      enrichedMetadata.contextSummary.push(`Team: ${metadata.team_members.slice(0, 3).join(', ')}${metadata.team_members.length > 3 ? '...' : ''}`);
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
      INSERT INTO work_memories (id, "userId", content, embedding, metadata, "createdAt", "updatedAt", "accessCount", "lastAccessed")
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

    const result = await this.prisma.workMemory.findUniqueOrThrow({
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
    const result = await this.prisma.workMemory.findFirst({
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
      
      await this.prisma.workMemory.update({
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
      await this.prisma.workMemory.delete({
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
    const memories = await this.prisma.workMemory.findMany({
      where: { userId }
    });

    const categories: Record<string, number> = {};
    let totalAccessCount = 0;

    for (const memory of memories) {
      const metadata = memory.metadata as WorkMetadata;
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
  private categorizeWorkContent(content: string): WorkMetadata['category'] {
    const lowerContent = content.toLowerCase();
    
    const categoryKeywords = {
      project: ['project', 'initiative', 'program', 'milestone', 'deliverable', 'scope'],
      meeting: ['meeting', 'standup', 'review', 'discussion', 'agenda', 'minutes', 'attendees'],
      task: ['task', 'todo', 'action item', 'assigned', 'complete', 'finish', 'due'],
      documentation: ['document', 'spec', 'requirements', 'design', 'architecture', 'guide', 'manual'],
      communication: ['email', 'slack', 'message', 'announcement', 'update', 'feedback'],
      planning: ['plan', 'strategy', 'roadmap', 'timeline', 'schedule', 'sprint']
    };
    
    let maxScore = 0;
    let bestCategory: WorkMetadata['category'] = 'task';
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const score = keywords.filter(keyword => lowerContent.includes(keyword)).length;
      if (score > maxScore) {
        maxScore = score;
        bestCategory = category as WorkMetadata['category'];
      }
    }
    
    return bestCategory;
  }

  private extractProjectName(content: string): string | undefined {
    // Look for patterns like "Project X", "X project", "working on X"
    const projectPatterns = [
      /(?:project|initiative|program)\s+["']?([A-Z][A-Za-z0-9\s-]+)["']?/i,
      /["']([A-Z][A-Za-z0-9\s-]+)["']?\s+(?:project|initiative|program)/i,
      /working on\s+["']?([A-Z][A-Za-z0-9\s-]+)["']?/i,
      /\b([A-Z]{2,}(?:-\d+)?)\b/ // Acronyms like "CRM-123"
    ];
    
    for (const pattern of projectPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return undefined;
  }

  private extractTeamMembers(content: string): string[] {
    const members: string[] = [];
    
    // Patterns for team members
    const memberPatterns = [
      /@([a-zA-Z]+(?:\.[a-zA-Z]+)?)/g, // @mentions
      /(?:with|from|by|assigned to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|should|needs to|is responsible)/g
    ];
    
    for (const pattern of memberPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const name = match[1].trim();
        if (name && !members.includes(name) && name.length > 2) {
          members.push(name);
        }
      }
    }
    
    return members.slice(0, 10); // Limit to 10 members
  }

  private extractDeadline(content: string): string | undefined {
    const lowerContent = content.toLowerCase();
    
    // Date patterns
    const datePatterns = [
      /(?:due|deadline|by|before|until)\s+(?:on\s+)?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
      /(?:due|deadline|by|before|until)\s+(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /(?:due|deadline|by|before|until)\s+(?:on\s+)?(tomorrow|today|next\s+week|this\s+week|end\s+of\s+(?:week|month))/i,
      /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(?:deadline|due date)/i,
      /(?:complete|finish|deliver)\s+by\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i
    ];
    
    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return undefined;
  }

  private assessPriority(content: string, metadata: WorkMetadata): WorkMetadata['priority'] {
    const lowerContent = content.toLowerCase();
    
    // Urgent keywords
    if (/urgent|asap|immediately|critical|emergency|blocker/.test(lowerContent)) {
      return 'urgent';
    }
    
    // High priority keywords
    if (/important|high priority|priority|key|crucial|essential/.test(lowerContent)) {
      return 'high';
    }
    
    // Low priority keywords
    if (/low priority|whenever|nice to have|optional|backlog/.test(lowerContent)) {
      return 'low';
    }
    
    // Check deadline proximity
    if (metadata.deadline) {
      const deadlineWords = metadata.deadline.toLowerCase();
      if (deadlineWords.includes('today') || deadlineWords.includes('tomorrow')) {
        return 'urgent';
      }
      if (deadlineWords.includes('this week')) {
        return 'high';
      }
    }
    
    return 'medium';
  }

  private extractActionItems(content: string): string[] {
    const actionItems: string[] = [];
    
    // Patterns for action items
    const actionPatterns = [
      /(?:action item|todo|task):\s*(.+?)(?:\n|$)/gi,
      /[-*]\s+(?:TODO:|ACTION:)?\s*(.+?)(?:\n|$)/gi,
      /\d+\.\s+(?:TODO:|ACTION:)?\s*(.+?)(?:\n|$)/gi,
      /(?:will|should|needs? to|must)\s+(.+?)(?:\.|;|\n|$)/gi
    ];
    
    for (const pattern of actionPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const item = match[1].trim();
        if (item && item.length > 5 && item.length < 200) {
          actionItems.push(item);
        }
      }
    }
    
    return actionItems.slice(0, 10); // Limit to 10 items
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];
    
    // Look for hashtags
    const hashtagMatches = content.match(/#[a-zA-Z0-9_]+/g) || [];
    tags.push(...hashtagMatches.map(tag => tag.substring(1)));
    
    // Look for technical terms
    const technicalTerms = content.match(/\b(?:API|UI|UX|MVP|POC|KPI|ROI|SLA|CI\/CD|QA)\b/g) || [];
    tags.push(...technicalTerms);
    
    // Department indicators
    const departments = content.match(/\b(?:engineering|sales|marketing|hr|finance|operations|product)\b/gi) || [];
    tags.push(...departments.map(d => d.toLowerCase()));
    
    // Remove duplicates and limit
    return [...new Set(tags)].slice(0, 10);
  }

  private calculateImportanceScore(metadata: WorkMetadata): number {
    let score = 0.5; // baseline
    
    // Priority contribution
    const priorityScores = {
      urgent: 0.3,
      high: 0.2,
      medium: 0.1,
      low: 0
    };
    score += priorityScores[metadata.priority || 'medium'];
    
    // Status contribution
    if (metadata.status === 'blocked') {
      score += 0.1;
    }
    
    // Deadline proximity (simplified)
    if (metadata.deadline) {
      const deadlineText = metadata.deadline.toLowerCase();
      if (deadlineText.includes('today') || deadlineText.includes('tomorrow')) {
        score += 0.2;
      } else if (deadlineText.includes('this week')) {
        score += 0.1;
      }
    }
    
    // Team size indicator
    if (metadata.team_members && metadata.team_members.length > 3) {
      score += 0.05;
    }
    
    return Math.min(1, score);
  }

  // Additional public methods
  async analyze(userId: string, options?: { 
    timeRange?: string; 
    category?: string;
    project?: string;
    status?: string;
  }): Promise<any> {
    try {
      const memories = await this.prisma.workMemory.findMany({
        where: { userId }
      });
      
      let filteredMemories = memories;
      
      // Apply filters
      if (options?.category) {
        filteredMemories = filteredMemories.filter(m => 
          (m.metadata as WorkMetadata).category === options.category
        );
      }
      if (options?.project) {
        filteredMemories = filteredMemories.filter(m => 
          (m.metadata as WorkMetadata).project_name === options.project
        );
      }
      if (options?.status) {
        filteredMemories = filteredMemories.filter(m => 
          (m.metadata as WorkMetadata).status === options.status
        );
      }
      
      const analysis = {
        total_memories: filteredMemories.length,
        categories: this.analyzeCategoryDistribution(filteredMemories),
        priority_breakdown: this.analyzePriorityDistribution(filteredMemories),
        status_summary: this.analyzeStatusDistribution(filteredMemories),
        active_projects: this.analyzeActiveProjects(filteredMemories),
        team_collaboration: this.analyzeTeamCollaboration(filteredMemories),
        upcoming_deadlines: this.analyzeUpcomingDeadlines(filteredMemories),
        blocked_items: this.getBlockedItems(filteredMemories),
        tag_cloud: this.generateTagCloud(filteredMemories)
      };
      
      return analysis;
    } catch (error) {
      this.logger.error('Error analyzing work memories', { error });
      throw error;
    }
  }

  private analyzeCategoryDistribution(memories: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const memory of memories) {
      const category = (memory.metadata as WorkMetadata).category || 'uncategorized';
      distribution[category] = (distribution[category] || 0) + 1;
    }
    
    return distribution;
  }

  private analyzePriorityDistribution(memories: any[]): Record<string, number> {
    const distribution: Record<string, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    
    for (const memory of memories) {
      const priority = (memory.metadata as WorkMetadata).priority || 'medium';
      distribution[priority]++;
    }
    
    return distribution;
  }

  private analyzeStatusDistribution(memories: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const memory of memories) {
      const status = (memory.metadata as WorkMetadata).status || 'active';
      distribution[status] = (distribution[status] || 0) + 1;
    }
    
    return distribution;
  }

  private analyzeActiveProjects(memories: any[]): Array<{
    name: string;
    taskCount: number;
    teamSize: number;
    priorities: Record<string, number>;
  }> {
    const projectMap: Record<string, any> = {};
    
    for (const memory of memories) {
      const metadata = memory.metadata as WorkMetadata;
      const projectName = metadata.project_name;
      
      if (projectName && metadata.status !== 'completed' && metadata.status !== 'archived') {
        if (!projectMap[projectName]) {
          projectMap[projectName] = {
            name: projectName,
            taskCount: 0,
            teamMembers: new Set<string>(),
            priorities: { urgent: 0, high: 0, medium: 0, low: 0 }
          };
        }
        
        projectMap[projectName].taskCount++;
        
        if (metadata.team_members) {
          metadata.team_members.forEach(member => 
            projectMap[projectName].teamMembers.add(member)
          );
        }
        
        const priority = metadata.priority || 'medium';
        projectMap[projectName].priorities[priority]++;
      }
    }
    
    return Object.values(projectMap).map(project => ({
      name: project.name,
      taskCount: project.taskCount,
      teamSize: project.teamMembers.size,
      priorities: project.priorities
    })).sort((a, b) => b.taskCount - a.taskCount);
  }

  private analyzeTeamCollaboration(memories: any[]): Record<string, number> {
    const collaboration: Record<string, number> = {};
    
    for (const memory of memories) {
      const teamMembers = (memory.metadata as WorkMetadata).team_members || [];
      for (const member of teamMembers) {
        collaboration[member] = (collaboration[member] || 0) + 1;
      }
    }
    
    return Object.fromEntries(
      Object.entries(collaboration)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
    );
  }

  private analyzeUpcomingDeadlines(memories: any[]): Array<{
    content: string;
    deadline: string;
    priority: string;
    project?: string;
  }> {
    return memories
      .filter(m => {
        const metadata = m.metadata as WorkMetadata;
        return metadata.deadline && 
               metadata.status !== 'completed' && 
               metadata.status !== 'archived';
      })
      .map(m => ({
        content: m.content.substring(0, 100) + '...',
        deadline: (m.metadata as WorkMetadata).deadline!,
        priority: (m.metadata as WorkMetadata).priority || 'medium',
        project: (m.metadata as WorkMetadata).project_name
      }))
      .slice(0, 10);
  }

  private getBlockedItems(memories: any[]): Array<{
    content: string;
    project?: string;
    blockedSince: Date;
  }> {
    return memories
      .filter(m => (m.metadata as WorkMetadata).status === 'blocked')
      .map(m => ({
        content: m.content.substring(0, 100) + '...',
        project: (m.metadata as WorkMetadata).project_name,
        blockedSince: m.updatedAt
      }))
      .slice(0, 10);
  }

  private generateTagCloud(memories: any[]): Record<string, number> {
    const tagCount: Record<string, number> = {};
    
    for (const memory of memories) {
      const tags = (memory.metadata as WorkMetadata).tags || [];
      for (const tag of tags) {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      }
    }
    
    return Object.fromEntries(
      Object.entries(tagCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
    );
  }
}