/**
 * Optimized SQL queries for Church module
 * Using direct SQL for structured metadata queries instead of semantic search
 */

import { prisma } from '@/utils/database';
import { Prisma } from '@prisma/client';
import { 
  PeopleFilters, 
  PersonSearchParams,
  MembershipStatus,
  Person,
  Household,
  Ministry,
  Tag
} from '@/modules/church/types';

export const ChurchQueries = {
  /**
   * List people with advanced filtering (SQL-optimized)
   */
  async listPeople(userId: string, params: PersonSearchParams) {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    
    // Build WHERE conditions
    let whereConditions = [
      Prisma.sql`"userId" = ${userId}`,
      Prisma.sql`metadata->>'type' = 'person'`
    ];

    // Add filters
    if (params.filters) {
      // Membership status filter
      if (params.filters.membershipStatus?.length) {
        if (params.filters.membershipStatus.length === 1) {
          whereConditions.push(
            Prisma.sql`metadata->>'membershipStatus' = ${params.filters.membershipStatus[0]}`
          );
        } else {
          const statusList = params.filters.membershipStatus.map(s => `'${s}'`).join(',');
          whereConditions.push(
            Prisma.sql`metadata->>'membershipStatus' IN (${Prisma.raw(statusList)})`
          );
        }
      }

      // Tags filter
      if (params.filters.tags?.length) {
        for (const tag of params.filters.tags) {
          whereConditions.push(
            Prisma.sql`metadata->'tags' ? ${tag}`
          );
        }
      }

      // Ministry filter
      if (params.filters.ministries?.length) {
        // This requires joining with ministry_role memories
        // For now, check customFields.ministry
        if (params.filters.ministries.length === 1) {
          whereConditions.push(
            Prisma.sql`metadata->'customFields'->>'ministry' = ${params.filters.ministries[0]}`
          );
        }
      }

      // Campus filter
      if (params.filters.campuses?.length) {
        if (params.filters.campuses.length === 1) {
          whereConditions.push(
            Prisma.sql`metadata->>'campusId' = ${params.filters.campuses[0]}`
          );
        }
      }

      // Age range filter
      if (params.filters.ageRange) {
        if (params.filters.ageRange.min !== undefined) {
          whereConditions.push(
            Prisma.sql`(metadata->>'age')::int >= ${params.filters.ageRange.min}`
          );
        }
        if (params.filters.ageRange.max !== undefined) {
          whereConditions.push(
            Prisma.sql`(metadata->>'age')::int <= ${params.filters.ageRange.max}`
          );
        }
      }

      // Gender filter
      if (params.filters.gender?.length) {
        if (params.filters.gender.length === 1) {
          whereConditions.push(
            Prisma.sql`metadata->>'gender' = ${params.filters.gender[0]}`
          );
        }
      }

      // Contact filters
      if (params.filters.hasEmail !== undefined) {
        if (params.filters.hasEmail) {
          whereConditions.push(
            Prisma.sql`jsonb_array_length(metadata->'contact'->'emails') > 0`
          );
        } else {
          whereConditions.push(
            Prisma.sql`(metadata->'contact'->'emails' IS NULL OR jsonb_array_length(metadata->'contact'->'emails') = 0)`
          );
        }
      }

      if (params.filters.hasPhone !== undefined) {
        if (params.filters.hasPhone) {
          whereConditions.push(
            Prisma.sql`jsonb_array_length(metadata->'contact'->'phones') > 0`
          );
        }
      }

      // Date filters
      if (params.filters.createdAfter) {
        whereConditions.push(
          Prisma.sql`(metadata->>'createdAt')::timestamp >= ${params.filters.createdAfter}`
        );
      }

      if (params.filters.createdBefore) {
        whereConditions.push(
          Prisma.sql`(metadata->>'createdAt')::timestamp <= ${params.filters.createdBefore}`
        );
      }

      // Last activity filter
      if (params.filters.lastActivityAfter) {
        whereConditions.push(
          Prisma.sql`(metadata->>'lastActivityDate')::timestamp >= ${params.filters.lastActivityAfter}`
        );
      }
    }

    // Add search query if provided
    if (params.query) {
      const searchTerm = `%${params.query}%`;
      whereConditions.push(
        Prisma.sql`(
          metadata->>'firstName' ILIKE ${searchTerm} OR
          metadata->>'lastName' ILIKE ${searchTerm} OR
          metadata->>'fullName' ILIKE ${searchTerm} OR
          metadata->'contact'->'emails'->0->>'address' ILIKE ${searchTerm}
        )`
      );
    }

    // Build complete query
    let query = Prisma.sql`
      SELECT 
        id,
        content,
        metadata,
        "createdAt",
        "updatedAt"
      FROM work_memories
      WHERE ${Prisma.join(whereConditions, ' AND ')}
    `;

    // Add sorting
    const sortField = params.sortBy || 'name';
    const sortOrder = params.sortOrder || 'asc';
    
    switch (sortField) {
      case 'name':
        query = Prisma.sql`${query} ORDER BY metadata->>'lastName' ${Prisma.raw(sortOrder)}, metadata->>'firstName' ${Prisma.raw(sortOrder)}`;
        break;
      case 'createdAt':
        query = Prisma.sql`${query} ORDER BY "createdAt" ${Prisma.raw(sortOrder)}`;
        break;
      case 'updatedAt':
        query = Prisma.sql`${query} ORDER BY "updatedAt" ${Prisma.raw(sortOrder)}`;
        break;
      case 'lastActivity':
        query = Prisma.sql`${query} ORDER BY metadata->>'lastActivityDate' ${Prisma.raw(sortOrder)} NULLS LAST`;
        break;
    }

    // Add pagination
    query = Prisma.sql`${query} LIMIT ${limit} OFFSET ${offset}`;

    return await prisma.$queryRaw(query);
  },

  /**
   * Count people matching filters
   */
  async countPeople(userId: string, filters?: PeopleFilters): Promise<number> {
    let whereConditions = [
      Prisma.sql`"userId" = ${userId}`,
      Prisma.sql`metadata->>'type' = 'person'`
    ];

    // Add same filters as listPeople (without pagination)
    if (filters?.membershipStatus?.length) {
      if (filters.membershipStatus.length === 1) {
        whereConditions.push(
          Prisma.sql`metadata->>'membershipStatus' = ${filters.membershipStatus[0]}`
        );
      }
    }

    // Add other filters as needed...

    const query = Prisma.sql`
      SELECT COUNT(*) as count
      FROM work_memories
      WHERE ${Prisma.join(whereConditions, ' AND ')}
    `;

    const result = await prisma.$queryRaw<[{count: bigint}]>(query);
    return Number(result[0].count);
  },

  /**
   * Search people by household
   */
  async getPeopleInHousehold(userId: string, householdId: string) {
    return await prisma.$queryRaw`
      SELECT 
        id,
        content,
        metadata,
        "createdAt",
        "updatedAt"
      FROM work_memories
      WHERE "userId" = ${userId}
        AND metadata->>'type' = 'person'
        AND metadata->>'householdId' = ${householdId}
      ORDER BY 
        CASE metadata->>'householdRole'
          WHEN 'head' THEN 1
          WHEN 'spouse' THEN 2
          WHEN 'child' THEN 3
          ELSE 4
        END,
        metadata->>'birthdate' ASC
    `;
  },

  /**
   * Get people by ministry with their roles
   */
  async getPeopleInMinistry(userId: string, ministryName: string) {
    // First get all ministry roles
    const roles = await prisma.$queryRaw<any[]>`
      SELECT 
        metadata->>'personId' as person_id,
        metadata->>'role' as role,
        metadata->>'startDate' as start_date
      FROM work_memories
      WHERE "userId" = ${userId}
        AND metadata->>'type' = 'ministry_role'
        AND metadata->>'ministryName' = ${ministryName}
        AND (metadata->>'isActive')::boolean = true
    `;

    if (roles.length === 0) return [];

    // Get people details
    const personIds = roles.map(r => r.person_id);
    const people = await prisma.$queryRaw<any[]>`
      SELECT 
        id,
        content,
        metadata
      FROM work_memories
      WHERE "userId" = ${userId}
        AND metadata->>'type' = 'person'
        AND metadata->>'id' = ANY(${personIds})
    `;

    // Merge role information
    return people.map((person: any) => ({
      ...person,
      ministryRole: roles.find(r => r.person_id === person.metadata.id)
    }));
  },

  /**
   * Get attendance statistics for a person
   */
  async getPersonAttendanceStats(userId: string, personId: string, dateRange?: { start: string; end: string }) {
    let dateConditions = [];
    
    if (dateRange) {
      dateConditions.push(
        Prisma.sql`(metadata->>'date')::timestamp >= ${dateRange.start}`,
        Prisma.sql`(metadata->>'date')::timestamp <= ${dateRange.end}`
      );
    }

    const whereConditions = [
      Prisma.sql`"userId" = ${userId}`,
      Prisma.sql`metadata->>'type' = 'attendance'`,
      Prisma.sql`metadata->>'personId' = ${personId}`,
      ...dateConditions
    ];

    const stats = await prisma.$queryRaw<any[]>`
      SELECT 
        metadata->>'eventType' as event_type,
        metadata->>'status' as status,
        COUNT(*) as count,
        MAX(metadata->>'date') as last_attended
      FROM work_memories
      WHERE ${Prisma.join(whereConditions, ' AND ')}
      GROUP BY 
        metadata->>'eventType',
        metadata->>'status'
    `;

    return stats;
  },

  /**
   * Find duplicate people by name/email
   */
  async findDuplicatePeople(userId: string) {
    // Find by exact name match
    const nameMatches = await prisma.$queryRaw`
      WITH name_groups AS (
        SELECT 
          metadata->>'firstName' as first_name,
          metadata->>'lastName' as last_name,
          COUNT(*) as count,
          json_agg(json_build_object(
            'id', metadata->>'id',
            'email', metadata->'contact'->'emails'->0->>'address',
            'membershipStatus', metadata->>'membershipStatus'
          )) as people
        FROM work_memories
        WHERE "userId" = ${userId}
          AND metadata->>'type' = 'person'
          AND metadata->>'membershipStatus' != 'inactive'
        GROUP BY 
          metadata->>'firstName',
          metadata->>'lastName'
        HAVING COUNT(*) > 1
      )
      SELECT * FROM name_groups
      ORDER BY count DESC
    `;

    // Find by email match
    const emailMatches = await prisma.$queryRaw`
      WITH email_groups AS (
        SELECT 
          metadata->'contact'->'emails'->0->>'address' as email,
          COUNT(*) as count,
          json_agg(json_build_object(
            'id', metadata->>'id',
            'name', metadata->>'fullName',
            'membershipStatus', metadata->>'membershipStatus'
          )) as people
        FROM work_memories
        WHERE "userId" = ${userId}
          AND metadata->>'type' = 'person'
          AND metadata->'contact'->'emails'->0->>'address' IS NOT NULL
          AND metadata->>'membershipStatus' != 'inactive'
        GROUP BY 
          metadata->'contact'->'emails'->0->>'address'
        HAVING COUNT(*) > 1
      )
      SELECT * FROM email_groups
      ORDER BY count DESC
    `;

    return {
      byName: nameMatches,
      byEmail: emailMatches
    };
  },

  /**
   * Get registry with efficient counts
   */
  async getRegistryWithCounts(userId: string, registryType: string) {
    // Get registry
    const registry = await prisma.$queryRaw<any[]>`
      SELECT 
        id,
        metadata
      FROM work_memories
      WHERE "userId" = ${userId}
        AND metadata->>'type' = 'registry'
        AND metadata->>'registryType' = ${registryType}
      LIMIT 1
    `;

    if (registry.length === 0) return null;

    const items = registry[0].metadata.items || [];

    // Get counts for each item based on registry type
    if (registryType === 'tags' && items.length > 0) {
      const tagNames = items.map((t: any) => t.name);
      
      const counts = await prisma.$queryRaw<Array<{tag: string, count: bigint}>>`
        SELECT 
          tag,
          COUNT(*) as count
        FROM work_memories,
        LATERAL jsonb_array_elements_text(metadata->'tags') as tag
        WHERE "userId" = ${userId}
          AND metadata->>'type' = 'person'
          AND tag = ANY(${tagNames})
        GROUP BY tag
      `;

      // Merge counts
      const countMap = new Map(counts.map(c => [c.tag, Number(c.count)]));
      items.forEach((item: any) => {
        item.usageCount = countMap.get(item.name) || 0;
      });
    }

    return {
      ...registry[0],
      metadata: {
        ...registry[0].metadata,
        items
      }
    };
  },

  /**
   * Bulk update helper
   */
  async bulkUpdateField(userId: string, personIds: string[], field: string, value: any) {
    // Use JSONB set for nested fields
    const fieldPath = field.split('.');
    let updateExpression;
    
    if (fieldPath.length === 1) {
      updateExpression = Prisma.sql`jsonb_set(metadata, ${Prisma.raw(`'{${field}}'`)}, ${JSON.stringify(value)}::jsonb)`;
    } else {
      // Handle nested fields like customFields.ministry
      const path = `{${fieldPath.join(',')}}`;
      updateExpression = Prisma.sql`jsonb_set(metadata, ${Prisma.raw(path)}, ${JSON.stringify(value)}::jsonb)`;
    }

    const updated = await prisma.$executeRaw`
      UPDATE work_memories
      SET 
        metadata = ${updateExpression},
        "updatedAt" = NOW()
      WHERE "userId" = ${userId}
        AND metadata->>'type' = 'person'
        AND metadata->>'id' = ANY(${personIds})
    `;

    return updated;
  },

  /**
   * Get people statistics for dashboard
   */
  async getPeopleStats(userId: string) {
    const stats = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN metadata->>'membershipStatus' = 'member' THEN 1 END) as members,
        COUNT(CASE WHEN metadata->>'membershipStatus' = 'regular' THEN 1 END) as regulars,
        COUNT(CASE WHEN metadata->>'membershipStatus' = 'visitor' THEN 1 END) as visitors,
        COUNT(CASE WHEN metadata->'contact'->>'emails' IS NOT NULL THEN 1 END) as withEmail,
        COUNT(CASE WHEN metadata->'contact'->>'phones' IS NOT NULL THEN 1 END) as withPhone
      FROM work_memories
      WHERE "userId" = ${userId}
        AND metadata->>'type' = 'person'
    `;

    return stats[0] || { total: 0, members: 0, regulars: 0, visitors: 0 };
  },

  /**
   * Get project statistics for dashboard
   */
  async getProjectStats(userId: string) {
    const stats = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN metadata->>'status' = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN metadata->>'status' = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN metadata->>'status' = 'on_hold' THEN 1 END) as onHold,
        COUNT(CASE WHEN metadata->>'status' = 'planning' THEN 1 END) as planning
      FROM work_memories
      WHERE "userId" = ${userId}
        AND metadata->>'type' = 'project'
    `;

    return stats[0] || { total: 0, active: 0, completed: 0, onHold: 0, planning: 0 };
  },

  /**
   * Get task statistics for dashboard
   */
  async getTaskStats(userId: string) {
    const stats = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN metadata->>'status' = 'todo' THEN 1 END) as todo,
        COUNT(CASE WHEN metadata->>'status' = 'in_progress' THEN 1 END) as inProgress,
        COUNT(CASE WHEN metadata->>'status' = 'done' THEN 1 END) as completed,
        COUNT(CASE WHEN metadata->>'status' = 'blocked' THEN 1 END) as blocked,
        COUNT(CASE WHEN metadata->>'priority' = 'urgent' THEN 1 END) as urgent,
        COUNT(CASE WHEN metadata->>'priority' = 'high' THEN 1 END) as highPriority,
        COUNT(CASE WHEN metadata->>'dueDate' < NOW()::text AND metadata->>'status' != 'done' THEN 1 END) as overdue
      FROM work_memories
      WHERE "userId" = ${userId}
        AND metadata->>'type' = 'task'
    `;

    return stats[0] || { 
      total: 0, 
      todo: 0, 
      inProgress: 0, 
      completed: 0, 
      blocked: 0,
      urgent: 0,
      highPriority: 0,
      overdue: 0
    };
  },

  /**
   * Get ministry statistics
   */
  async getMinistryStats(userId: string) {
    const stats = await prisma.$queryRaw<any[]>`
      WITH ministry_counts AS (
        SELECT 
          metadata->'customFields'->>'ministry' as ministry,
          COUNT(*) as count
        FROM work_memories
        WHERE "userId" = ${userId}
          AND metadata->>'type' = 'person'
          AND metadata->'customFields'->>'ministry' IS NOT NULL
        GROUP BY metadata->'customFields'->>'ministry'
      )
      SELECT 
        ministry,
        count,
        ROUND((count::numeric / SUM(count) OVER ()) * 100, 1) as percentage
      FROM ministry_counts
      ORDER BY count DESC
    `;

    return stats;
  }
};

/**
 * Database function to efficiently count memories by category
 */
export const createChurchDatabaseFunctions = async () => {
  // Function to get person counts by various criteria
  await prisma.$executeRaw`
    CREATE OR REPLACE FUNCTION get_people_stats(user_id TEXT)
    RETURNS TABLE(
      stat_type TEXT,
      stat_value TEXT,
      count BIGINT
    ) AS $$
    BEGIN
      RETURN QUERY
      -- By membership status
      SELECT 
        'membership_status'::TEXT,
        metadata->>'membershipStatus',
        COUNT(*)::BIGINT
      FROM work_memories
      WHERE "userId" = user_id
        AND metadata->>'type' = 'person'
      GROUP BY metadata->>'membershipStatus'
      
      UNION ALL
      
      -- By gender
      SELECT 
        'gender'::TEXT,
        metadata->>'gender',
        COUNT(*)::BIGINT
      FROM work_memories
      WHERE "userId" = user_id
        AND metadata->>'type' = 'person'
        AND metadata->>'gender' IS NOT NULL
      GROUP BY metadata->>'gender'
      
      UNION ALL
      
      -- By campus
      SELECT 
        'campus'::TEXT,
        metadata->>'campusId',
        COUNT(*)::BIGINT
      FROM work_memories
      WHERE "userId" = user_id
        AND metadata->>'type' = 'person'
        AND metadata->>'campusId' IS NOT NULL
      GROUP BY metadata->>'campusId';
    END;
    $$ LANGUAGE plpgsql STABLE;
  `;

  // Function to search people with relevance ranking
  await prisma.$executeRaw`
    CREATE OR REPLACE FUNCTION search_people_ranked(
      user_id TEXT,
      search_term TEXT
    )
    RETURNS TABLE(
      id UUID,
      content TEXT,
      metadata JSONB,
      relevance_score FLOAT
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        m.id,
        m.content,
        m.metadata,
        (
          CASE WHEN m.metadata->>'lastName' ILIKE search_term || '%' THEN 10.0 ELSE 0.0 END +
          CASE WHEN m.metadata->>'firstName' ILIKE search_term || '%' THEN 8.0 ELSE 0.0 END +
          CASE WHEN m.metadata->>'fullName' ILIKE '%' || search_term || '%' THEN 6.0 ELSE 0.0 END +
          CASE WHEN m.metadata->'contact'->'emails'->0->>'address' ILIKE '%' || search_term || '%' THEN 4.0 ELSE 0.0 END +
          CASE WHEN m.content ILIKE '%' || search_term || '%' THEN 2.0 ELSE 0.0 END +
          CASE WHEN m.metadata::text ILIKE '%' || search_term || '%' THEN 1.0 ELSE 0.0 END
        ) as relevance_score
      FROM work_memories m
      WHERE m."userId" = user_id
        AND m.metadata->>'type' = 'person'
        AND (
          m.metadata->>'lastName' ILIKE '%' || search_term || '%' OR
          m.metadata->>'firstName' ILIKE '%' || search_term || '%' OR
          m.metadata->>'fullName' ILIKE '%' || search_term || '%' OR
          m.metadata->'contact'->'emails'->0->>'address' ILIKE '%' || search_term || '%' OR
          m.content ILIKE '%' || search_term || '%'
        )
      ORDER BY relevance_score DESC, m."updatedAt" DESC
      LIMIT 100;
    END;
    $$ LANGUAGE plpgsql STABLE;
  `;
};