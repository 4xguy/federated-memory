import { ChurchModule } from '@/modules/church/ChurchModule';
import { 
  Person,
  PersonMetadata,
  PartialPerson,
  PersonUpdate,
  Household,
  HouseholdMetadata,
  HouseholdMember,
  CustomFieldDefinition,
  MinistryRole,
  Attendance,
  PeopleFilters,
  PersonSearchParams,
  PersonSearchResult,
  Ministry,
  Tag,
  Campus,
  MembershipStatus,
  HouseholdRole,
  BulkOperation,
  BulkOperationResult,
  ExportOptions,
  ImportOptions
} from '@/modules/church/types';
import { Memory } from '@/core/modules/interfaces';
import { v4 as uuidv4 } from 'uuid';
import RealtimeService from './realtime.service';
import { logger } from '@/utils/logger';
import { prisma } from '@/utils/database';

/**
 * Service for managing church people, households, and related data
 * Uses the universal memory architecture for all storage
 */
export class ChurchService {
  private module: ChurchModule;
  private cmiService: any;
  private realtimeService: RealtimeService;
  
  constructor(
    private embeddingService: any,
    cmiService: any
  ) {
    this.realtimeService = RealtimeService.getInstance();
    this.module = new ChurchModule({
      id: 'church',
      name: 'Church Management',
      description: 'Manages people, households, ministries, and church-related data',
      tableName: 'work_memories', // Using existing table
      metadata: {
        searchableFields: ['type', 'membershipStatus', 'tags', 'ministry', 'householdId'],
        requiredFields: ['type'],
        indexedFields: ['type', 'membershipStatus', 'lastName']
      }
    }, embeddingService);
    
    this.cmiService = cmiService;
  }

  async initialize(): Promise<void> {
    await this.module.initialize();
    
    // Initialize default registries
    await this.initializeRegistries();
  }

  // ============= Person Management =============

  async createPerson(userId: string, person: PartialPerson): Promise<Person> {
    const personId = uuidv4();
    const now = new Date();
    
    const fullPerson: Person = {
      id: personId,
      firstName: person.firstName || '',
      lastName: person.lastName || '',
      membershipStatus: person.membershipStatus || MembershipStatus.GUEST,
      contact: person.contact || { emails: [], phones: [] },
      tags: person.tags || [],
      ...person
    };

    // Create metadata
    const metadata: PersonMetadata = {
      ...fullPerson,
      type: 'person',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    // Generate content for semantic search
    const content = this.module.generateContent(metadata);
    
    // Store in module
    const memoryId = await this.module.store(userId, content, metadata);
    
    // Register with CMI for cross-module search
    await this.cmiService.indexMemory(userId, 'church', memoryId, content, metadata);

    // Send real-time notification
    await this.realtimeService.notifyMemoryChange(userId, 'created', fullPerson);

    logger.info('Person created', { userId, personId });
    return fullPerson;
  }

  async updatePerson(userId: string, personId: string, updates: PersonUpdate): Promise<Person | null> {
    const person = await this.getPerson(userId, personId);
    if (!person) return null;

    // Find the memory
    const memories = await this.module.searchByMetadata(userId, {
      type: 'person',
      id: personId
    });

    if (memories.length === 0) return null;

    const memory = memories[0];
    const updatedPerson: Person = {
      ...person,
      ...updates,
      id: personId // Ensure ID doesn't change
    };

    const updatedMetadata: PersonMetadata = {
      ...updatedPerson,
      type: 'person',
      createdAt: memory.metadata.createdAt,
      updatedAt: new Date().toISOString(),
      version: (memory.metadata.version || 1) + 1
    };

    // Update content
    const content = this.module.generateContent(updatedMetadata);
    
    // Update memory
    await this.module.update(userId, memory.id, {
      content,
      metadata: updatedMetadata
    });

    // Update CMI
    await this.cmiService.update(userId, memory.id, {
      content: content,
      metadata: updatedMetadata
    });

    // Send real-time notification
    await this.realtimeService.notifyMemoryChange(userId, 'updated', updatedPerson);

    logger.info('Person updated', { userId, personId });
    return updatedPerson;
  }

  async getPerson(userId: string, personId: string): Promise<Person | null> {
    const memories = await this.module.searchByMetadata(userId, {
      type: 'person',
      id: personId
    });

    if (memories.length === 0) return null;

    const metadata = memories[0].metadata as PersonMetadata;
    return this.metadataToPerson(metadata);
  }

  async searchPeople(userId: string, params: PersonSearchParams): Promise<PersonSearchResult[]> {
    let results: Memory[];

    if (params.query && !params.filters) {
      // Natural language search using semantic search
      try {
        logger.info('Attempting semantic search for people', { userId, query: params.query });
        
        results = await this.module.search(userId, params.query, {
          limit: params.limit || 20,
          offset: params.offset || 0
        });
        
        logger.info('Semantic search completed', { userId, resultCount: results.length });
        
        // Filter to only person types
        results = results.filter(m => m.metadata.type === 'person');
        
        logger.info('Filtered to person types', { userId, personCount: results.length });
        
      } catch (error) {
        logger.error('Semantic search failed, falling back to structured search', { 
          userId, 
          query: params.query, 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        
        // Fallback to structured search using basic text matching
        const fallbackParams: PersonSearchParams = {
          ...params,
          filters: {
            ...(params.filters || {}),
            searchTerm: params.query // Add search term as a filter
          }
        };
        results = await this.searchPeopleByFilters(userId, fallbackParams);
      }
    } else {
      // Structured search using SQL
      results = await this.searchPeopleByFilters(userId, params);
    }

    // Convert to PersonSearchResult
    return results.map(memory => ({
      person: this.metadataToPerson(memory.metadata as PersonMetadata),
      score: (memory as any).score,
      matchedFields: this.getMatchedFields(memory, params.query)
    }));
  }

  async listPeople(userId: string, params: PersonSearchParams): Promise<{
    results: Person[];
    total: number;
    hasMore: boolean;
  }> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;

    // Use SQL for efficient listing
    const results = await this.searchPeopleByFilters(userId, params);
    const people = results.map(m => this.metadataToPerson(m.metadata as PersonMetadata));

    // Get total count
    const total = await this.countPeople(userId, params.filters);

    return {
      results: people,
      total,
      hasMore: offset + people.length < total
    };
  }

  async mergePeople(userId: string, sourceId: string, targetId: string): Promise<Person | null> {
    const source = await this.getPerson(userId, sourceId);
    const target = await this.getPerson(userId, targetId);

    if (!source || !target) {
      throw new Error('One or both people not found');
    }

    // Merge data (target takes precedence)
    const merged: PersonUpdate = {
      // Basic info - prefer target unless empty
      firstName: target.firstName || source.firstName,
      lastName: target.lastName || source.lastName,
      middleName: target.middleName || source.middleName,
      nickname: target.nickname || source.nickname,
      
      // Demographics - prefer target
      gender: target.gender || source.gender,
      birthdate: target.birthdate || source.birthdate,
      maritalStatus: target.maritalStatus || source.maritalStatus,
      
      // Contact - merge arrays
      contact: {
        emails: this.mergeContactArrays(target.contact.emails, source.contact.emails),
        phones: this.mergeContactArrays(target.contact.phones, source.contact.phones),
        address: target.contact.address || source.contact.address
      },
      
      // Membership - prefer target
      membershipStatus: target.membershipStatus,
      membershipDate: target.membershipDate || source.membershipDate,
      householdId: target.householdId || source.householdId,
      
      // Church-specific - prefer target unless empty
      baptismDate: target.baptismDate || source.baptismDate,
      baptismLocation: target.baptismLocation || source.baptismLocation,
      salvationDate: target.salvationDate || source.salvationDate,
      
      // Custom fields - deep merge
      customFields: {
        ...source.customFields,
        ...target.customFields
      },
      
      // Tags - merge and deduplicate
      tags: [...new Set([...target.tags, ...source.tags])],
      
      // Notes - concatenate
      notes: [target.notes, source.notes].filter(Boolean).join('\n\n')
    };

    // Update target with merged data
    const updatedPerson = await this.updatePerson(userId, targetId, merged);

    // Delete source
    await this.deletePerson(userId, sourceId);

    // Update any references to source person
    await this.updatePersonReferences(userId, sourceId, targetId);

    logger.info('People merged', { userId, sourceId, targetId });
    return updatedPerson;
  }

  async deletePerson(userId: string, personId: string, hardDelete = false): Promise<boolean> {
    const memories = await this.module.searchByMetadata(userId, {
      type: 'person',
      id: personId
    });

    if (memories.length === 0) return false;

    const memory = memories[0];

    if (hardDelete) {
      // Permanently delete
      await this.module.delete(userId, memory.id);
      await this.cmiService.removeFromIndex(userId, 'church', memory.id);
    } else {
      // Soft delete - mark as inactive
      const metadata = memory.metadata as PersonMetadata;
      metadata.membershipStatus = MembershipStatus.INACTIVE;
      metadata.updatedAt = new Date().toISOString();
      
      await this.module.update(userId, memory.id, { metadata });
    }

    await this.realtimeService.notifyMemoryChange(userId, 'deleted', { personId });
    logger.info('Person deleted', { userId, personId, hardDelete });
    return true;
  }

  // ============= Household Management =============

  async createHousehold(userId: string, household: Partial<Household>): Promise<Household> {
    const householdId = uuidv4();
    
    const fullHousehold: Household = {
      id: householdId,
      name: household.name || 'New Household',
      members: household.members || [],
      ...household
    };

    const metadata: HouseholdMetadata = {
      ...fullHousehold,
      type: 'household',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const content = this.module.generateContent(metadata);
    const memoryId = await this.module.store(userId, content, metadata);
    
    await this.cmiService.indexMemory(userId, 'church', memoryId, content, metadata);

    logger.info('Household created', { userId, householdId });
    return fullHousehold;
  }

  async updateHousehold(userId: string, householdId: string, updates: Partial<Household>): Promise<Household | null> {
    const memories = await this.module.searchByMetadata(userId, {
      type: 'household',
      id: householdId
    });

    if (memories.length === 0) return null;

    const memory = memories[0];
    const current = memory.metadata as HouseholdMetadata;
    
    const updated: HouseholdMetadata = {
      ...current,
      ...updates,
      id: householdId,
      updatedAt: new Date().toISOString()
    };

    const content = this.module.generateContent(updated);
    await this.module.update(userId, memory.id, { content, metadata: updated });

    logger.info('Household updated', { userId, householdId });
    return this.metadataToHousehold(updated);
  }

  async addPersonToHousehold(userId: string, personId: string, householdId: string, role: HouseholdRole = HouseholdRole.OTHER): Promise<boolean> {
    // Update person's household reference
    const person = await this.getPerson(userId, personId);
    if (!person) return false;

    await this.updatePerson(userId, personId, {
      householdId,
      householdRole: role
    });

    // Update household's member list
    const household = await this.getHousehold(userId, householdId);
    if (!household) return false;

    const members = household.members.filter(m => m.personId !== personId);
    members.push({
      personId,
      role,
      isPrimary: role === HouseholdRole.HEAD
    });

    await this.updateHousehold(userId, householdId, { members });

    logger.info('Person added to household', { userId, personId, householdId, role });
    return true;
  }

  async getHousehold(userId: string, householdId: string): Promise<Household | null> {
    const memories = await this.module.searchByMetadata(userId, {
      type: 'household',
      id: householdId
    });

    if (memories.length === 0) return null;

    return this.metadataToHousehold(memories[0].metadata as HouseholdMetadata);
  }

  // ============= Custom Fields & Tags =============

  async defineCustomField(userId: string, field: Partial<CustomFieldDefinition>): Promise<CustomFieldDefinition> {
    // Ensure module is specified - default to 'people' for Church service
    const module = field.module || 'people';
    
    const fieldDef: CustomFieldDefinition = {
      id: uuidv4(),
      name: field.name || '',
      fieldKey: field.fieldKey || field.name?.toLowerCase().replace(/\s+/g, '_') || '',
      module,
      type: field.type || 'text',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      ...field
    };

    // Get or create module-specific custom fields registry
    const registryName = `custom_fields_${module}`;
    const registry = await this.module.getOrCreateRegistry(userId, registryName);
    const items = registry.metadata.items || [];
    
    // Check for duplicate field key within this module
    if (items.find((f: any) => f.fieldKey === fieldDef.fieldKey)) {
      throw new Error(`Custom field '${fieldDef.fieldKey}' already exists in ${module} module`);
    }

    items.push(fieldDef);
    
    await this.module.update(userId, registry.id, {
      metadata: {
        ...registry.metadata,
        items,
        module, // Track which module this registry belongs to
        updatedAt: new Date().toISOString()
      }
    });

    logger.info('Module-scoped custom field defined', { 
      userId, 
      module,
      fieldKey: fieldDef.fieldKey,
      registryName 
    });
    return fieldDef;
  }

  async getCustomFieldDefinition(userId: string, fieldKey: string, module: string): Promise<CustomFieldDefinition | null> {
    const registryName = `custom_fields_${module}`;
    
    try {
      const registry = await this.module.getOrCreateRegistry(userId, registryName);
      const items = registry.metadata.items || [];
      
      return items.find((field: CustomFieldDefinition) => field.fieldKey === fieldKey) || null;
    } catch (error) {
      logger.warn('Failed to get custom field definition', { userId, fieldKey, module, error });
      return null;
    }
  }

  async getCustomFieldsForModule(userId: string, module: string): Promise<CustomFieldDefinition[]> {
    const registryName = `custom_fields_${module}`;
    
    try {
      const registry = await this.module.getOrCreateRegistry(userId, registryName);
      return registry.metadata.items || [];
    } catch (error) {
      logger.warn('Failed to get custom fields for module', { userId, module, error });
      return [];
    }
  }

  private validateCustomFieldValue(fieldDefinition: CustomFieldDefinition, value: any): any {
    const { type, required, validation, options } = fieldDefinition;

    // Check required
    if (required && (value === null || value === undefined || value === '')) {
      throw new Error(`Custom field '${fieldDefinition.name}' is required`);
    }

    // If value is empty/null and not required, return as-is
    if (!required && (value === null || value === undefined || value === '')) {
      return value;
    }

    // Type validation
    switch (type) {
      case 'text':
        if (typeof value !== 'string') {
          throw new Error(`Field '${fieldDefinition.name}' must be text`);
        }
        if (validation?.pattern && !new RegExp(validation.pattern).test(value)) {
          throw new Error(`Field '${fieldDefinition.name}' does not match required pattern`);
        }
        if (validation?.min && value.length < validation.min) {
          throw new Error(`Field '${fieldDefinition.name}' must be at least ${validation.min} characters`);
        }
        if (validation?.max && value.length > validation.max) {
          throw new Error(`Field '${fieldDefinition.name}' must be no more than ${validation.max} characters`);
        }
        break;

      case 'number':
        const numValue = Number(value);
        if (isNaN(numValue)) {
          throw new Error(`Field '${fieldDefinition.name}' must be a number`);
        }
        if (validation?.min && numValue < validation.min) {
          throw new Error(`Field '${fieldDefinition.name}' must be at least ${validation.min}`);
        }
        if (validation?.max && numValue > validation.max) {
          throw new Error(`Field '${fieldDefinition.name}' must be no more than ${validation.max}`);
        }
        return numValue;

      case 'boolean':
        return Boolean(value);

      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error(`Field '${fieldDefinition.name}' must be a valid date`);
        }
        return date.toISOString();

      case 'select':
        if (options && !options.includes(value)) {
          throw new Error(`Field '${fieldDefinition.name}' must be one of: ${options.join(', ')}`);
        }
        break;

      case 'multiselect':
        if (!Array.isArray(value)) {
          throw new Error(`Field '${fieldDefinition.name}' must be an array`);
        }
        if (options) {
          const invalidValues = value.filter(v => !options.includes(v));
          if (invalidValues.length > 0) {
            throw new Error(`Field '${fieldDefinition.name}' contains invalid values: ${invalidValues.join(', ')}`);
          }
        }
        break;
    }

    return value;
  }

  async setPersonCustomField(
    userId: string, 
    personId: string, 
    fieldKey: string, 
    value: any,
    module: string = 'people'
  ): Promise<boolean> {
    const person = await this.getPerson(userId, personId);
    if (!person) return false;

    // Validate that the custom field exists in the specified module
    const fieldDefinition = await this.getCustomFieldDefinition(userId, fieldKey, module);
    if (!fieldDefinition) {
      throw new Error(`Custom field '${fieldKey}' not found in ${module} module`);
    }

    // Validate the value against field definition
    const validatedValue = this.validateCustomFieldValue(fieldDefinition, value);

    const customFields = person.customFields || {};
    // Store with module prefix to avoid conflicts
    const moduleFieldKey = `${module}.${fieldKey}`;
    customFields[moduleFieldKey] = validatedValue;

    await this.updatePerson(userId, personId, { customFields });
    
    logger.info('Module-scoped custom field set', { userId, personId, module, fieldKey, moduleFieldKey });
    return true;
  }

  async tagPerson(userId: string, personId: string, tags: string[], operation: 'add' | 'remove' | 'set' = 'add'): Promise<boolean> {
    const person = await this.getPerson(userId, personId);
    if (!person) return false;

    let newTags: string[];
    
    switch (operation) {
      case 'add':
        newTags = [...new Set([...person.tags, ...tags])];
        break;
      case 'remove':
        newTags = person.tags.filter(t => !tags.includes(t));
        break;
      case 'set':
        newTags = tags;
        break;
    }

    await this.updatePerson(userId, personId, { tags: newTags });
    
    // Update tag registry
    await this.updateTagRegistry(userId, tags);
    
    logger.info('Person tagged', { userId, personId, tags, operation });
    return true;
  }

  // ============= Lists & Export =============

  async createPeopleList(userId: string, name: string, filters: PeopleFilters, description?: string): Promise<string> {
    const listId = uuidv4();
    
    const listData = {
      type: 'people_list',
      id: listId,
      name,
      description,
      filters,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublic: false
    };

    const content = `People List: ${name} - ${description || 'Custom filtered list'}`;
    const memoryId = await this.module.store(userId, content, listData);
    
    logger.info('People list created', { userId, listId, name });
    return listId;
  }

  async exportPeopleData(userId: string, options: ExportOptions): Promise<any> {
    // Get people based on filters
    const params: PersonSearchParams = {
      filters: options.filters,
      limit: 10000 // Reasonable export limit
    };

    const { results } = await this.listPeople(userId, params);

    switch (options.format) {
      case 'json':
        return this.exportToJSON(results, options);
      case 'csv':
        return this.exportToCSV(results, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  async bulkUpdatePeople(userId: string, operation: BulkOperation): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: [],
      failed: [],
      totalProcessed: operation.targetIds.length,
      successCount: 0,
      failureCount: 0
    };

    for (const personId of operation.targetIds) {
      try {
        switch (operation.operation) {
          case 'update':
            if (operation.updates) {
              await this.updatePerson(userId, personId, operation.updates);
            }
            break;
          
          case 'tag':
            if (operation.tags) {
              await this.tagPerson(userId, personId, operation.tags, 'add');
            }
            break;
          
          case 'untag':
            if (operation.tags) {
              await this.tagPerson(userId, personId, operation.tags, 'remove');
            }
            break;
          
          case 'assign':
            if (operation.ministry) {
              await this.assignMinistryRole(userId, personId, operation.ministry, 'member');
            }
            break;
          
          case 'delete':
            await this.deletePerson(userId, personId, false);
            break;
        }
        
        result.successful.push(personId);
        result.successCount++;
      } catch (error) {
        result.failed.push({
          id: personId,
          reason: error instanceof Error ? error.message : String(error)
        });
        result.failureCount++;
      }
    }

    logger.info('Bulk operation completed', { 
      userId, 
      operation: operation.operation, 
      success: result.successCount, 
      failed: result.failureCount 
    });
    
    return result;
  }

  // ============= Ministry & Attendance =============

  async assignMinistryRole(userId: string, personId: string, ministryName: string, role: string): Promise<MinistryRole> {
    const roleId = uuidv4();
    
    const ministryRole: MinistryRole = {
      id: roleId,
      personId,
      ministryName,
      role,
      startDate: new Date().toISOString(),
      isActive: true
    };

    const metadata = {
      type: 'ministry_role',
      ...ministryRole
    };

    const content = this.module.generateContent(metadata);
    await this.module.store(userId, content, metadata);
    
    // Update ministry registry
    await this.updateMinistryRegistry(userId, ministryName);
    
    logger.info('Ministry role assigned', { userId, personId, ministryName, role });
    return ministryRole;
  }

  async listMinistryMembers(userId: string, ministryName: string): Promise<Person[]> {
    // Get all ministry roles for this ministry
    const allRoles = await this.module.searchByMetadata(userId, {
      type: 'ministry_role',
      ministryName
    });

    // Filter for active roles (handling both boolean and string values)
    const activeRoles = allRoles.filter(role => {
      const isActive = role.metadata.isActive;
      return isActive === true || isActive === 'true';
    });

    // Get unique person IDs
    const personIds = [...new Set(activeRoles.map(r => r.metadata.personId as string))];
    
    // Fetch all people
    const people = await Promise.all(
      personIds.map(id => this.getPerson(userId, id))
    );

    return people.filter(p => p !== null) as Person[];
  }

  async trackAttendance(
    userId: string, 
    personId: string, 
    eventType: Attendance['eventType'],
    eventName: string,
    date: string = new Date().toISOString(),
    status: Attendance['status'] = 'present'
  ): Promise<Attendance> {
    const attendanceId = uuidv4();
    
    const attendance: Attendance = {
      id: attendanceId,
      personId,
      eventType,
      eventName,
      date,
      status,
      checkInTime: status === 'present' ? new Date().toISOString() : undefined
    };

    const metadata = {
      type: 'attendance',
      ...attendance
    };

    const content = this.module.generateContent(metadata);
    await this.module.store(userId, content, metadata);
    
    logger.info('Attendance tracked', { userId, personId, eventName, status });
    return attendance;
  }

  // ============= Helper Methods =============

  private metadataToPerson(metadata: PersonMetadata): Person {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { type, createdAt, updatedAt, version, ...person } = metadata;
    return person as Person;
  }

  private metadataToHousehold(metadata: HouseholdMetadata): Household {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { type, createdAt, updatedAt, version, ...household } = metadata;
    return household as Household;
  }

  private mergeContactArrays<T extends { primary: boolean }>(target: T[], source: T[]): T[] {
    const merged = [...target];
    
    // Add non-duplicate items from source
    for (const item of source) {
      const isDuplicate = merged.some(m => 
        JSON.stringify(m) === JSON.stringify(item)
      );
      
      if (!isDuplicate) {
        // If source has primary, make sure only one primary exists
        if (item.primary) {
          merged.forEach(m => m.primary = false);
        }
        merged.push(item);
      }
    }
    
    return merged;
  }

  private async searchPeopleByFilters(userId: string, params: PersonSearchParams): Promise<Memory[]> {
    // Handle text search with SQL LIKE queries for fallback
    if (params.filters?.searchTerm) {
      const searchTerm = params.filters.searchTerm.toLowerCase();
      
      try {
        const results = await prisma.$queryRaw<Memory[]>`
          SELECT id, "userId", content, metadata, "accessCount", "lastAccessed", "createdAt", "updatedAt"
          FROM work_memories
          WHERE "userId" = ${userId}
            AND metadata->>'type' = 'person'
            AND (
              LOWER(metadata->>'firstName') LIKE ${`%${searchTerm}%`}
              OR LOWER(metadata->>'lastName') LIKE ${`%${searchTerm}%`}
              OR LOWER(metadata->>'nickname') LIKE ${`%${searchTerm}%`}
              OR LOWER(content) LIKE ${`%${searchTerm}%`}
            )
          ORDER BY "updatedAt" DESC
          LIMIT ${params.limit || 20}
          OFFSET ${params.offset || 0}
        `;
        
        logger.info('Text search fallback completed', { userId, searchTerm, resultCount: results.length });
        return results;
      } catch (error) {
        logger.error('Text search fallback failed', { userId, searchTerm, error });
        // Fall through to basic metadata search
      }
    }
    
    // Basic metadata search for other filters
    const criteria: any = { type: 'person' };
    
    if (params.filters) {
      if (params.filters.membershipStatus?.length) {
        // For single status, use direct match
        if (params.filters.membershipStatus.length === 1) {
          criteria.membershipStatus = params.filters.membershipStatus[0];
        }
      }
    }

    return this.module.searchByMetadata(userId, criteria);
  }

  private async countPeople(userId: string, filters?: PeopleFilters): Promise<number> {
    // This will be optimized in church-queries.ts
    const results = await this.searchPeopleByFilters(userId, { filters });
    return results.length;
  }

  private getMatchedFields(memory: Memory, query?: string): string[] {
    if (!query) return [];
    
    const fields: string[] = [];
    const lowerQuery = query.toLowerCase();
    const metadata = memory.metadata;
    
    if (metadata.firstName?.toLowerCase().includes(lowerQuery)) fields.push('firstName');
    if (metadata.lastName?.toLowerCase().includes(lowerQuery)) fields.push('lastName');
    if (metadata.email?.toLowerCase().includes(lowerQuery)) fields.push('email');
    if (memory.content.toLowerCase().includes(lowerQuery)) fields.push('content');
    
    return fields;
  }

  private async updatePersonReferences(userId: string, oldId: string, newId: string): Promise<void> {
    // Update household memberships
    const households = await this.module.searchByMetadata(userId, { type: 'household' });
    
    for (const household of households) {
      const members = household.metadata.members as HouseholdMember[];
      let updated = false;
      
      for (const member of members) {
        if (member.personId === oldId) {
          member.personId = newId;
          updated = true;
        }
      }
      
      if (updated) {
        await this.module.update(userId, household.id, { metadata: household.metadata });
      }
    }
    
    // Update ministry roles, attendance records, etc.
    // This would be expanded as needed
  }

  private async initializeRegistries(): Promise<void> {
    // Initialize default registries if they don't exist
    // Default ministries and tags are defined here for future implementation
    // when we add system-level defaults or template creation
    
    // const defaultMinistries: Ministry[] = [
    //   { name: 'Worship', description: 'Music and worship team', icon: '🎵', isActive: true },
    //   { name: 'Children', description: "Children's ministry", icon: '👶', isActive: true },
    //   { name: 'Youth', description: 'Youth ministry', icon: '🎓', isActive: true },
    //   { name: 'Administration', description: 'Church administration', icon: '💼', isActive: true }
    // ];

    // const defaultTags: Tag[] = [
    //   { name: 'volunteer', category: 'involvement', color: '#4CAF50' },
    //   { name: 'new-member', category: 'status', color: '#2196F3' },
    //   { name: 'leadership', category: 'role', color: '#FF9800' }
    // ];

    // These would be created for the system user or first user
    // Registries are user-specific in our architecture
  }

  private async updateTagRegistry(userId: string, tags: string[]): Promise<void> {
    const registry = await this.module.getOrCreateRegistry(userId, 'tags');
    const items = registry.metadata.items || [];
    
    for (const tag of tags) {
      if (!items.find((t: any) => t.name === tag)) {
        items.push({ name: tag, usageCount: 1 });
      } else {
        const existing = items.find((t: any) => t.name === tag);
        if (existing) existing.usageCount = (existing.usageCount || 0) + 1;
      }
    }
    
    await this.module.update(userId, registry.id, {
      metadata: { ...registry.metadata, items, updatedAt: new Date().toISOString() }
    });
  }

  private async updateMinistryRegistry(userId: string, ministryName: string): Promise<void> {
    const registry = await this.module.getOrCreateRegistry(userId, 'ministries');
    const items = registry.metadata.items || [];
    
    if (!items.find((m: any) => m.name === ministryName)) {
      items.push({ name: ministryName, isActive: true });
      
      await this.module.update(userId, registry.id, {
        metadata: { ...registry.metadata, items, updatedAt: new Date().toISOString() }
      });
    }
  }

  private exportToJSON(people: Person[], options: ExportOptions): any {
    const data = people.map(person => {
      if (options.fields) {
        // Export only specified fields
        const filtered: any = {};
        for (const field of options.fields) {
          filtered[field] = (person as any)[field];
        }
        return filtered;
      }
      return person;
    });

    return {
      exportDate: new Date().toISOString(),
      totalRecords: data.length,
      data
    };
  }

  private exportToCSV(people: Person[], options: ExportOptions): string {
    if (people.length === 0) return '';

    // Determine fields to export
    const fields = options.fields || Object.keys(people[0]);
    
    // Create header
    const header = fields.join(',');
    
    // Create rows
    const rows = people.map(person => {
      return fields.map(field => {
        const value = (person as any)[field];
        
        // Handle different value types
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
        
        return value;
      }).join(',');
    });

    return [header, ...rows].join('\n');
  }
}