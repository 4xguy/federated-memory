import { BaseModule, ModuleInfo } from '../../core/modules/base.module';
import { ModuleConfig, Memory, SearchOptions, ModuleStats, ModuleType } from '../../core/modules/interfaces';
import { 
  Person, 
  PersonMetadata, 
  Household, 
  HouseholdMetadata,
  CustomFieldDefinition,
  Ministry,
  Tag,
  Campus,
  Attendance,
  MembershipStatus
} from './types';
import { EmbeddingService } from '../../core/embeddings/generator.service';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';

/**
 * Church Module for managing people, households, ministries, and related data
 * All data is stored as memories with rich metadata for both SQL and semantic search
 */
export class ChurchModule extends BaseModule {
  constructor(config: ModuleConfig, embeddingService: EmbeddingService) {
    super(config);
  }

  getModuleInfo(): ModuleInfo {
    return {
      name: 'Church Management',
      description: 'Manages people, households, ministries, and church-related data',
      type: 'work' as ModuleType
    };
  }

  /**
   * Process and enrich metadata for church-specific entities
   */
  async processMetadata(content: string, metadata: Record<string, any>): Promise<Record<string, any>> {
    const enrichedMetadata = { ...metadata };

    // Add timestamps if not present
    if (!enrichedMetadata.createdAt) {
      enrichedMetadata.createdAt = new Date().toISOString();
    }
    enrichedMetadata.updatedAt = new Date().toISOString();

    // Process based on type
    switch (metadata.type) {
      case 'person':
        return this.processPersonMetadata(enrichedMetadata);
      
      case 'household':
        return this.processHouseholdMetadata(enrichedMetadata);
      
      case 'attendance':
        return this.processAttendanceMetadata(enrichedMetadata);
      
      case 'ministry_role':
      case 'group_membership':
        return this.processRelationshipMetadata(enrichedMetadata);
      
      case 'registry':
        return this.processRegistryMetadata(enrichedMetadata);
      
      default:
        return enrichedMetadata;
    }
  }

  /**
   * Format search results with church-specific context
   */
  formatSearchResult(memory: Memory): Memory {
    // Add any church-specific formatting
    return {
      ...memory,
      // Ensure sensitive data is not exposed based on privacy settings
      metadata: this.filterMetadataByPrivacy(memory.metadata)
    };
  }

  /**
   * Generate content for semantic search based on entity type
   */
  public generateContent(entity: Record<string, any>): string {
    switch (entity.type) {
      case 'person':
        return this.generatePersonContent(entity as PersonMetadata);
      
      case 'household':
        return this.generateHouseholdContent(entity as HouseholdMetadata);
      
      case 'attendance':
        return this.generateAttendanceContent(entity);
      
      case 'ministry_role':
        return this.generateMinistryRoleContent(entity);
      
      default:
        return JSON.stringify(entity);
    }
  }

  // ============= Private Helper Methods =============

  private processPersonMetadata(metadata: Record<string, any>): Record<string, any> {
    // Ensure required fields
    if (!metadata.membershipStatus) {
      metadata.membershipStatus = MembershipStatus.GUEST;
    }

    // Initialize arrays
    metadata.tags = metadata.tags || [];
    
    // Initialize contact structure
    if (!metadata.contact) {
      metadata.contact = {
        emails: [],
        phones: []
      };
    }

    // Add searchable full name
    metadata.fullName = `${metadata.firstName || ''} ${metadata.lastName || ''}`.trim();
    
    // Add age if birthdate is provided
    if (metadata.birthdate) {
      const birthDate = new Date(metadata.birthdate);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      metadata.age = age;
    }

    return metadata;
  }

  private processHouseholdMetadata(metadata: Record<string, any>): Record<string, any> {
    // Initialize members array
    metadata.members = metadata.members || [];
    
    // Generate searchable member list
    metadata.memberCount = metadata.members.length;
    
    return metadata;
  }

  private processAttendanceMetadata(metadata: Record<string, any>): Record<string, any> {
    // Ensure date is ISO string
    if (metadata.date && !(metadata.date instanceof String)) {
      metadata.date = new Date(metadata.date).toISOString();
    }
    
    // Default status
    if (!metadata.status) {
      metadata.status = 'present';
    }
    
    return metadata;
  }

  private processRelationshipMetadata(metadata: Record<string, any>): Record<string, any> {
    // Add active status based on dates
    if (!metadata.isActive && metadata.startDate) {
      const now = new Date();
      const start = new Date(metadata.startDate);
      const end = metadata.endDate ? new Date(metadata.endDate) : null;
      
      metadata.isActive = start <= now && (!end || end > now);
    }
    
    return metadata;
  }

  private processRegistryMetadata(metadata: Record<string, any>): Record<string, any> {
    // Ensure items array exists
    metadata.items = metadata.items || [];
    
    // Add item count
    metadata.itemCount = metadata.items.length;
    
    // Update version
    metadata.version = (metadata.version || 0) + 1;
    
    return metadata;
  }

  private generatePersonContent(person: PersonMetadata): string {
    const parts = [
      `Person: ${person.firstName} ${person.lastName}`,
      person.nickname ? `Known as: ${person.nickname}` : null,
      `Status: ${person.membershipStatus}`,
      person.contact?.emails?.[0]?.address ? `Email: ${person.contact.emails[0].address}` : null,
      person.contact?.phones?.[0]?.number ? `Phone: ${person.contact.phones[0].number}` : null,
      person.customFields?.ministry ? `Ministry: ${person.customFields.ministry}` : null,
      person.customFields?.spiritualGifts?.length 
        ? `Spiritual Gifts: ${person.customFields.spiritualGifts.join(', ')}` 
        : null,
      person.tags?.length ? `Tags: ${person.tags.join(', ')}` : null,
      person.notes ? `Notes: ${person.notes}` : null
    ].filter(Boolean);
    
    return parts.join('\n');
  }

  private generateHouseholdContent(household: HouseholdMetadata): string {
    const parts = [
      `Household: ${household.name}`,
      household.formalName ? `Formal: ${household.formalName}` : null,
      `Members: ${household.members.length} people`,
      household.address 
        ? `Address: ${household.address.street1}, ${household.address.city}, ${household.address.state}` 
        : null,
      household.tags?.length ? `Tags: ${household.tags.join(', ')}` : null
    ].filter(Boolean);
    
    return parts.join('\n');
  }

  private generateAttendanceContent(attendance: any): string {
    return `Attendance: ${attendance.personName || attendance.personId} at ${attendance.eventName} on ${attendance.date}. Status: ${attendance.status}`;
  }

  private generateMinistryRoleContent(role: any): string {
    return `Ministry Role: ${role.personName || role.personId} serves as ${role.role} in ${role.ministryName}`;
  }

  private filterMetadataByPrivacy(metadata: Record<string, any>): Record<string, any> {
    if (!metadata.privacy) {
      return metadata;
    }

    const filtered = { ...metadata };
    
    if (metadata.privacy.hideEmail && filtered.contact?.emails) {
      filtered.contact.emails = [];
    }
    
    if (metadata.privacy.hidePhone && filtered.contact?.phones) {
      filtered.contact.phones = [];
    }
    
    if (metadata.privacy.hideAddress && filtered.contact?.address) {
      delete filtered.contact.address;
    }
    
    return filtered;
  }

  // ============= Search Helpers =============

  /**
   * Search for people by metadata fields using SQL
   */
  async searchByMetadata(userId: string, criteria: Record<string, any>): Promise<Memory[]> {
    try {
      // Build SQL query for metadata search
      let whereConditions = [`"userId" = $1`];
      const values: any[] = [userId];
      let paramIndex = 2;

      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          whereConditions.push(`metadata->>'${key}' = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      });

      const query = `
        SELECT id, "userId", content, metadata, "accessCount", "lastAccessed", "createdAt", "updatedAt"
        FROM church_memories
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY "updatedAt" DESC
      `;

      const results = await this.prisma.$queryRawUnsafe<Memory[]>(query, ...values);
      return results;
    } catch (error) {
      throw new Error(`Metadata search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get or create a registry memory
   */
  async getOrCreateRegistry(userId: string, registryType: string, defaultItems: any[] = []): Promise<Memory> {
    const registries = await this.searchByMetadata(userId, {
      type: 'registry',
      registryType: registryType
    });

    if (registries.length > 0) {
      return registries[0];
    }

    // Create new registry
    const registryData = {
      type: 'registry',
      registryType: registryType,
      name: `${registryType}_registry`,
      items: defaultItems,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const content = `Registry: ${registryType} - System registry for ${registryType}`;
    const memoryId = await this.store(userId, content, registryData);
    
    return {
      id: memoryId,
      userId,
      content,
      metadata: registryData,
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // ============= Required Abstract Methods =============

  async searchByEmbedding(
    userId: string,
    embedding: number[],
    options?: SearchOptions
  ): Promise<Memory[]> {
    try {
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;

      const query = `
        SELECT 
          id, "userId", content, metadata, embedding,
          "accessCount", "lastAccessed", "createdAt", "updatedAt",
          1 - (embedding <=> $2::vector) as similarity
        FROM church_memories
        WHERE "userId" = $1
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $2::vector
        LIMIT $3 OFFSET $4
      `;

      const results = await this.prisma.$queryRawUnsafe<Memory[]>(
        query,
        userId,
        JSON.stringify(embedding),
        limit,
        offset
      );

      return results.map(r => this.formatSearchResult(r));
    } catch (error) {
      this.logger.error('Search by embedding failed', { error });
      throw error;
    }
  }

  protected async storeInModule(
    userId: string,
    content: string,
    embedding: number[],
    metadata: Record<string, any>
  ): Promise<Memory> {
    const id = uuidv4();
    
    // Store using raw SQL to handle vector type
    await this.prisma.$executeRaw`
      INSERT INTO church_memories (id, "userId", content, embedding, metadata, "accessCount", "lastAccessed", "createdAt", "updatedAt")
      VALUES (${id}, ${userId}, ${content}, ${JSON.stringify(embedding)}::vector, ${metadata}, 0, NOW(), NOW(), NOW())
    `;

    // Fetch the created memory
    const memory = await this.prisma.churchMemory.findUnique({
      where: { id }
    });

    if (!memory) {
      throw new Error('Failed to store memory');
    }

    return {
      ...memory,
      metadata: memory.metadata as Record<string, any>
    };
  }

  protected async getFromModule(userId: string, memoryId: string): Promise<Memory | null> {
    const memory = await this.prisma.churchMemory.findFirst({
      where: {
        id: memoryId,
        userId
      }
    });

    if (!memory) return null;

    return {
      ...memory,
      metadata: memory.metadata as Record<string, any>
    };
  }

  protected async updateInModule(
    userId: string,
    memoryId: string,
    updates: Partial<Memory>
  ): Promise<boolean> {
    try {
      await this.prisma.churchMemory.update({
        where: {
          id: memoryId,
          userId
        },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  protected async deleteFromModule(userId: string, memoryId: string): Promise<boolean> {
    try {
      await this.prisma.churchMemory.delete({
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
    const totalCount = await this.prisma.churchMemory.count({
      where: { userId }
    });

    const avgAccessCount = await this.prisma.churchMemory.aggregate({
      where: { userId },
      _avg: { accessCount: true }
    });

    const typeBreakdown = await this.prisma.$queryRaw<Array<{type: string, count: bigint}>>`
      SELECT metadata->>'type' as type, COUNT(*) as count
      FROM church_memories
      WHERE "userId" = ${userId}
      GROUP BY metadata->>'type'
    `;

    return {
      totalMemories: totalCount,
      averageAccessCount: avgAccessCount._avg.accessCount || 0,
      totalSize: 0, // TODO: Calculate actual size
      lastAccessed: new Date(),
      mostFrequentCategories: typeBreakdown.slice(0, 5).map(t => t.type)
    };
  }

  protected async onInitialize(): Promise<void> {
    // Initialize any church-specific resources
    this.logger.info('Church module initialized');
  }

  protected async onShutdown(): Promise<void> {
    // Clean up any church-specific resources
    this.logger.info('Church module shut down');
  }
}