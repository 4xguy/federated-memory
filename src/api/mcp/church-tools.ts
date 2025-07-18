import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ChurchService } from '@/services/church.service';
import { logger } from '@/utils/logger';
import { ChurchQueries } from './church-queries';
import {
  MembershipStatus,
  HouseholdRole,
  PersonSearchParams,
  PeopleFilters,
  ExportOptions,
  BulkOperation,
  Attendance
} from '@/modules/church/types';

interface UserContext {
  userId: string;
  email: string;
  name?: string;
}

/**
 * Register all Church module MCP tools
 * These tools provide comprehensive people management capabilities
 */
export function registerChurchTools(
  server: McpServer,
  churchService: ChurchService,
  userContext?: UserContext
) {
  // ============= Core Person Management (Tools 1-6) =============

  // Tool 1: Create Person
  server.registerTool(
    'createPerson',
    {
      title: 'Create Person',
      description: 'Create a new person in the church database',
      inputSchema: {
        firstName: z.string().describe('First name of the person'),
        lastName: z.string().describe('Last name of the person'),
        middleName: z.string().optional().describe('Middle name'),
        nickname: z.string().optional().describe('Preferred name or nickname'),
        email: z.string().email().optional().describe('Primary email address'),
        phone: z.string().optional().describe('Primary phone number'),
        birthdate: z.string().optional().describe('Birth date (ISO 8601 format)'),
        gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
        membershipStatus: z.enum(['guest', 'regular', 'member', 'inactive'])
          .optional()
          .describe('Membership status (defaults to guest)'),
        householdId: z.string().optional().describe('ID of household they belong to'),
        tags: z.array(z.string()).optional().describe('Tags for categorization'),
        customFields: z.record(z.any()).optional().describe('Custom field values'),
        notes: z.string().optional().describe('Additional notes')
      }
    },
    async (params) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const person = await churchService.createPerson(userContext.userId, {
          firstName: params.firstName,
          lastName: params.lastName,
          middleName: params.middleName,
          nickname: params.nickname,
          membershipStatus: params.membershipStatus as MembershipStatus,
          contact: {
            emails: params.email ? [{
              type: 'personal',
              address: params.email,
              primary: true
            }] : [],
            phones: params.phone ? [{
              type: 'mobile',
              number: params.phone,
              primary: true,
              canText: true
            }] : []
          },
          birthdate: params.birthdate,
          gender: params.gender,
          householdId: params.householdId,
          tags: params.tags || [],
          customFields: params.customFields || {},
          notes: params.notes
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              person: person,
              message: `Created person: ${person.firstName} ${person.lastName}`
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Create person error', { error, params });
        return {
          content: [{
            type: 'text',
            text: `Error creating person: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool 2: Update Person
  server.registerTool(
    'updatePerson',
    {
      title: 'Update Person',
      description: 'Update an existing person\'s information',
      inputSchema: {
        personId: z.string().describe('ID of the person to update'),
        updates: z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          middleName: z.string().optional(),
          nickname: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          birthdate: z.string().optional(),
          gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
          membershipStatus: z.enum(['guest', 'regular', 'member', 'inactive']).optional(),
          householdId: z.string().optional(),
          tags: z.array(z.string()).optional(),
          customFields: z.record(z.any()).optional(),
          notes: z.string().optional()
        }).describe('Fields to update')
      }
    },
    async ({ personId, updates }) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        // Build update object
        const personUpdate: any = { ...updates };

        // Handle email update
        if (updates.email) {
          const person = await churchService.getPerson(userContext.userId, personId);
          if (person) {
            personUpdate.contact = {
              ...person.contact,
              emails: [{
                type: 'personal',
                address: updates.email,
                primary: true
              }]
            };
            delete personUpdate.email;
          }
        }

        // Handle phone update
        if (updates.phone) {
          const person = await churchService.getPerson(userContext.userId, personId);
          if (person) {
            personUpdate.contact = {
              ...person.contact,
              phones: [{
                type: 'mobile',
                number: updates.phone,
                primary: true,
                canText: true
              }]
            };
            delete personUpdate.phone;
          }
        }

        const updated = await churchService.updatePerson(userContext.userId, personId, personUpdate);

        if (!updated) {
          return {
            content: [{
              type: 'text',
              text: `Person not found with ID: ${personId}`
            }],
            isError: true
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              person: updated,
              message: 'Person updated successfully'
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Update person error', { error, personId, updates });
        return {
          content: [{
            type: 'text',
            text: `Error updating person: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool 3: Get Person
  server.registerTool(
    'getPerson',
    {
      title: 'Get Person',
      description: 'Retrieve a person by their ID',
      inputSchema: {
        personId: z.string().describe('The ID of the person to retrieve')
      }
    },
    async ({ personId }) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const person = await churchService.getPerson(userContext.userId, personId);

        if (!person) {
          return {
            content: [{
              type: 'text',
              text: `Person not found with ID: ${personId}`
            }],
            isError: true
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(person, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Get person error', { error, personId });
        return {
          content: [{
            type: 'text',
            text: `Error retrieving person: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool 4: Search People
  server.registerTool(
    'searchPeople',
    {
      title: 'Search People',
      description: 'Search for people using natural language or filters',
      inputSchema: {
        query: z.string().optional()
          .describe('Search query (name, email, or natural language like "young families with children")'),
        filters: z.object({
          membershipStatus: z.array(z.enum(['guest', 'regular', 'member', 'inactive'])).optional(),
          tags: z.array(z.string()).optional(),
          ministries: z.array(z.string()).optional(),
          hasEmail: z.boolean().optional(),
          hasPhone: z.boolean().optional(),
          ageRange: z.object({
            min: z.number().optional(),
            max: z.number().optional()
          }).optional()
        }).optional().describe('Structured filters'),
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0)
      }
    },
    async ({ query, filters, limit, offset }) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const params: PersonSearchParams = {
          query,
          filters: filters as PeopleFilters,
          limit,
          offset
        };

        const results = await churchService.searchPeople(userContext.userId, params);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              results: results.map(r => ({
                person: r.person,
                score: r.score,
                matchedFields: r.matchedFields
              })),
              total: results.length,
              query: query,
              filters: filters
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Search people error', { error, query, filters });
        return {
          content: [{
            type: 'text',
            text: `Error searching people: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool 5: List People
  server.registerTool(
    'listPeople',
    {
      title: 'List People',
      description: 'List people with pagination and filters',
      inputSchema: {
        filters: z.object({
          membershipStatus: z.array(z.enum(['guest', 'regular', 'member', 'inactive'])).optional(),
          tags: z.array(z.string()).optional(),
          ministries: z.array(z.string()).optional(),
          campuses: z.array(z.string()).optional(),
          hasEmail: z.boolean().optional(),
          hasPhone: z.boolean().optional()
        }).optional().describe('Filter criteria'),
        limit: z.number().min(1).max(100).optional().default(20),
        offset: z.number().min(0).optional().default(0),
        sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'lastActivity']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional()
      }
    },
    async ({ filters, limit, offset, sortBy, sortOrder }) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        // Use optimized SQL query
        const results = await ChurchQueries.listPeople(userContext.userId, {
          filters: filters as PeopleFilters,
          limit,
          offset,
          sortBy,
          sortOrder
        });

        // Get total count
        const total = await ChurchQueries.countPeople(userContext.userId, filters as PeopleFilters);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              results: results,
              total: total,
              limit: limit,
              offset: offset,
              hasMore: offset + (results as any[]).length < total
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('List people error', { error, filters });
        return {
          content: [{
            type: 'text',
            text: `Error listing people: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool 6: Merge People
  server.registerTool(
    'mergePeople',
    {
      title: 'Merge People',
      description: 'Merge duplicate person records (source into target)',
      inputSchema: {
        sourceId: z.string().describe('ID of person to merge FROM (will be deleted)'),
        targetId: z.string().describe('ID of person to merge INTO (will be kept)')
      }
    },
    async ({ sourceId, targetId }) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const merged = await churchService.mergePeople(userContext.userId, sourceId, targetId);

        if (!merged) {
          return {
            content: [{
              type: 'text',
              text: 'Failed to merge people - one or both not found'
            }],
            isError: true
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              mergedPerson: merged,
              message: `Merged person ${sourceId} into ${targetId}`
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Merge people error', { error, sourceId, targetId });
        return {
          content: [{
            type: 'text',
            text: `Error merging people: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // ============= Household Management (Tools 7-9) =============

  // Tool 7: Create Household
  server.registerTool(
    'createHousehold',
    {
      title: 'Create Household',
      description: 'Create a new household',
      inputSchema: {
        name: z.string().describe('Household name (e.g., "The Smith Family")'),
        formalName: z.string().optional().describe('Formal name (e.g., "Mr. and Mrs. John Smith")'),
        informalName: z.string().optional().describe('Informal name (e.g., "John & Jane")'),
        address: z.object({
          street1: z.string(),
          street2: z.string().optional(),
          city: z.string(),
          state: z.string(),
          postalCode: z.string(),
          country: z.string().optional()
        }).optional().describe('Household address'),
        homePhone: z.string().optional(),
        memberIds: z.array(z.string()).optional().describe('Initial member IDs to add')
      }
    },
    async (params) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const household = await churchService.createHousehold(userContext.userId, {
          name: params.name,
          formalName: params.formalName,
          informalName: params.informalName,
          address: params.address,
          homePhone: params.homePhone,
          members: params.memberIds?.map(id => ({
            personId: id,
            role: HouseholdRole.OTHER,
            isPrimary: false
          })) || []
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              household: household,
              message: `Created household: ${household.name}`
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Create household error', { error, params });
        return {
          content: [{
            type: 'text',
            text: `Error creating household: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool 8: Update Household
  server.registerTool(
    'updateHousehold',
    {
      title: 'Update Household',
      description: 'Update household information',
      inputSchema: {
        householdId: z.string().describe('ID of household to update'),
        updates: z.object({
          name: z.string().optional(),
          formalName: z.string().optional(),
          informalName: z.string().optional(),
          address: z.object({
            street1: z.string(),
            street2: z.string().optional(),
            city: z.string(),
            state: z.string(),
            postalCode: z.string(),
            country: z.string().optional()
          }).optional(),
          homePhone: z.string().optional(),
          primaryContactId: z.string().optional()
        }).describe('Fields to update')
      }
    },
    async ({ householdId, updates }) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const updated = await churchService.updateHousehold(userContext.userId, householdId, updates);

        if (!updated) {
          return {
            content: [{
              type: 'text',
              text: `Household not found with ID: ${householdId}`
            }],
            isError: true
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              household: updated,
              message: 'Household updated successfully'
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Update household error', { error, householdId, updates });
        return {
          content: [{
            type: 'text',
            text: `Error updating household: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool 9: Add Person to Household
  server.registerTool(
    'addPersonToHousehold',
    {
      title: 'Add Person to Household',
      description: 'Add a person to a household',
      inputSchema: {
        personId: z.string().describe('ID of person to add'),
        householdId: z.string().describe('ID of household'),
        role: z.enum(['head', 'spouse', 'child', 'other'])
          .optional()
          .describe('Role in household (defaults to other)')
      }
    },
    async ({ personId, householdId, role }) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const success = await churchService.addPersonToHousehold(
          userContext.userId,
          personId,
          householdId,
          role as HouseholdRole
        );

        if (!success) {
          return {
            content: [{
              type: 'text',
              text: 'Failed to add person to household - person or household not found'
            }],
            isError: true
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Added person ${personId} to household ${householdId} as ${role || 'other'}`
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Add person to household error', { error, personId, householdId });
        return {
          content: [{
            type: 'text',
            text: `Error adding person to household: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // ============= Custom Fields & Tags (Tools 10-12) =============

  // Tool 10: Define Custom Field
  server.registerTool(
    'defineCustomField',
    {
      title: 'Define Custom Field',
      description: 'Create a new custom field definition',
      inputSchema: {
        name: z.string().describe('Display name of the field'),
        fieldKey: z.string().optional().describe('Unique key (auto-generated from name if not provided)'),
        type: z.enum(['text', 'number', 'date', 'boolean', 'select', 'multiselect']),
        options: z.array(z.string()).optional().describe('Options for select/multiselect fields'),
        required: z.boolean().optional(),
        category: z.string().optional().describe('Category to group related fields'),
        description: z.string().optional(),
        visibility: z.enum(['public', 'leaders', 'admin']).optional()
      }
    },
    async (params) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const field = await churchService.defineCustomField(userContext.userId, params);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              field: field,
              message: `Created custom field: ${field.name}`
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Define custom field error', { error, params });
        return {
          content: [{
            type: 'text',
            text: `Error defining custom field: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool 11: Set Person Custom Field
  server.registerTool(
    'setPersonCustomField',
    {
      title: 'Set Person Custom Field',
      description: 'Set a custom field value for a person',
      inputSchema: {
        personId: z.string().describe('ID of the person'),
        fieldKey: z.string().describe('Key of the custom field'),
        value: z.any().describe('Value to set (type depends on field definition)')
      }
    },
    async ({ personId, fieldKey, value }) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const success = await churchService.setPersonCustomField(
          userContext.userId,
          personId,
          fieldKey,
          value
        );

        if (!success) {
          return {
            content: [{
              type: 'text',
              text: `Failed to set custom field - person not found`
            }],
            isError: true
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Set custom field ${fieldKey} for person ${personId}`
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Set custom field error', { error, personId, fieldKey });
        return {
          content: [{
            type: 'text',
            text: `Error setting custom field: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool 12: Tag Person
  server.registerTool(
    'tagPerson',
    {
      title: 'Tag Person',
      description: 'Add, remove, or set tags for a person',
      inputSchema: {
        personId: z.string().describe('ID of the person'),
        tags: z.array(z.string()).describe('Tags to apply'),
        operation: z.enum(['add', 'remove', 'set'])
          .optional()
          .describe('Operation to perform (defaults to add)')
      }
    },
    async ({ personId, tags, operation }) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const success = await churchService.tagPerson(
          userContext.userId,
          personId,
          tags,
          operation || 'add'
        );

        if (!success) {
          return {
            content: [{
              type: 'text',
              text: `Failed to tag person - person not found`
            }],
            isError: true
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `${operation || 'add'} tags for person ${personId}`,
              tags: tags
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Tag person error', { error, personId, tags });
        return {
          content: [{
            type: 'text',
            text: `Error tagging person: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // ============= Communication & Lists (Tools 13-15) =============

  // Tool 13: Create People List
  server.registerTool(
    'createPeopleList',
    {
      title: 'Create People List',
      description: 'Create a saved list with filters',
      inputSchema: {
        name: z.string().describe('Name of the list'),
        description: z.string().optional(),
        filters: z.object({
          membershipStatus: z.array(z.enum(['guest', 'regular', 'member', 'inactive'])).optional(),
          tags: z.array(z.string()).optional(),
          ministries: z.array(z.string()).optional(),
          hasEmail: z.boolean().optional(),
          hasPhone: z.boolean().optional(),
          customFields: z.record(z.any()).optional()
        }).describe('Filters that define the list')
      }
    },
    async ({ name, description, filters }) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const listId = await churchService.createPeopleList(
          userContext.userId,
          name,
          filters as PeopleFilters,
          description
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              listId: listId,
              name: name,
              message: `Created people list: ${name}`
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Create people list error', { error, name, filters });
        return {
          content: [{
            type: 'text',
            text: `Error creating people list: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool 14: Export People Data
  server.registerTool(
    'exportPeopleData',
    {
      title: 'Export People Data',
      description: 'Export people data in various formats',
      inputSchema: {
        format: z.enum(['csv', 'json']).describe('Export format'),
        filters: z.object({
          membershipStatus: z.array(z.enum(['guest', 'regular', 'member', 'inactive'])).optional(),
          tags: z.array(z.string()).optional(),
          ministries: z.array(z.string()).optional()
        }).optional().describe('Filters to apply before export'),
        fields: z.array(z.string()).optional()
          .describe('Specific fields to include (defaults to all)'),
        includeCustomFields: z.boolean().optional().default(true)
      }
    },
    async ({ format, filters, fields, includeCustomFields }) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const exportData = await churchService.exportPeopleData(userContext.userId, {
          format,
          filters: filters as PeopleFilters,
          fields,
          includeCustomFields
        } as ExportOptions);

        return {
          content: [{
            type: 'text',
            text: format === 'json' 
              ? JSON.stringify(exportData, null, 2)
              : exportData
          }]
        };
      } catch (error) {
        logger.error('Export people error', { error, format, filters });
        return {
          content: [{
            type: 'text',
            text: `Error exporting data: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool 15: Bulk Update People
  server.registerTool(
    'bulkUpdatePeople',
    {
      title: 'Bulk Update People',
      description: 'Update multiple people at once',
      inputSchema: {
        operation: z.enum(['update', 'tag', 'untag', 'assign', 'delete'])
          .describe('Operation to perform'),
        targetIds: z.array(z.string()).describe('IDs of people to update'),
        updates: z.object({
          membershipStatus: z.enum(['guest', 'regular', 'member', 'inactive']).optional(),
          customFields: z.record(z.any()).optional()
        }).optional().describe('Updates for update operation'),
        tags: z.array(z.string()).optional().describe('Tags for tag/untag operations'),
        ministry: z.string().optional().describe('Ministry for assign operation')
      }
    },
    async ({ operation, targetIds, updates, tags, ministry }) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const bulkOp: BulkOperation = {
          operation,
          targetIds,
          updates: updates ? {
            ...updates,
            membershipStatus: updates.membershipStatus as MembershipStatus
          } : undefined,
          tags,
          ministry
        };

        const result = await churchService.bulkUpdatePeople(userContext.userId, bulkOp);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              result: result,
              message: `Bulk ${operation} completed: ${result.successCount} succeeded, ${result.failureCount} failed`
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Bulk update error', { error, operation, targetIds });
        return {
          content: [{
            type: 'text',
            text: `Error in bulk update: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // ============= Ministry & Roles (Tools 16-18) =============

  // Tool 16: Assign Ministry Role
  server.registerTool(
    'assignMinistryRole',
    {
      title: 'Assign Ministry Role',
      description: 'Assign a person to a ministry with a specific role',
      inputSchema: {
        personId: z.string().describe('ID of the person'),
        ministryName: z.string().describe('Name of the ministry'),
        role: z.string().describe('Role in the ministry (e.g., "leader", "member", "volunteer")')
      }
    },
    async ({ personId, ministryName, role }) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const ministryRole = await churchService.assignMinistryRole(
          userContext.userId,
          personId,
          ministryName,
          role
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              ministryRole: ministryRole,
              message: `Assigned ${role} role in ${ministryName} to person ${personId}`
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Assign ministry role error', { error, personId, ministryName, role });
        return {
          content: [{
            type: 'text',
            text: `Error assigning ministry role: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool 17: List Ministry Members
  server.registerTool(
    'listMinistryMembers',
    {
      title: 'List Ministry Members',
      description: 'Get all people in a specific ministry',
      inputSchema: {
        ministryName: z.string().describe('Name of the ministry')
      }
    },
    async ({ ministryName }) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const members = await churchService.listMinistryMembers(userContext.userId, ministryName);

        // Get roles for each member
        const membersWithRoles = await ChurchQueries.getPeopleInMinistry(
          userContext.userId,
          ministryName
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ministry: ministryName,
              totalMembers: membersWithRoles.length,
              members: membersWithRoles
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('List ministry members error', { error, ministryName });
        return {
          content: [{
            type: 'text',
            text: `Error listing ministry members: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  // Tool 18: Track Attendance
  server.registerTool(
    'trackAttendance',
    {
      title: 'Track Attendance',
      description: 'Record attendance for a person at an event',
      inputSchema: {
        personId: z.string().describe('ID of the person'),
        eventType: z.enum(['service', 'group', 'class', 'event']),
        eventName: z.string().describe('Name of the event'),
        date: z.string().optional().describe('Date of attendance (defaults to now)'),
        status: z.enum(['present', 'absent', 'late', 'excused'])
          .optional()
          .describe('Attendance status (defaults to present)'),
        notes: z.string().optional()
      }
    },
    async ({ personId, eventType, eventName, date, status, notes }) => {
      if (!userContext?.userId) {
        throw new Error('Authentication required');
      }

      try {
        const attendance = await churchService.trackAttendance(
          userContext.userId,
          personId,
          eventType as Attendance['eventType'],
          eventName,
          date,
          status as Attendance['status']
        );

        // Add notes if provided
        if (notes && attendance) {
          attendance.notes = notes;
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              attendance: attendance,
              message: `Tracked ${status || 'present'} attendance for ${eventName}`
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Track attendance error', { error, personId, eventName });
        return {
          content: [{
            type: 'text',
            text: `Error tracking attendance: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );

  logger.info('Church tools registered', { toolCount: 18 });
}