# Church Module Documentation

## Overview

The Church module is a comprehensive Church CRM (Customer Relationship Management) system built on the Federated Memory architecture. It provides complete people management capabilities including person records, households, ministries, custom fields, and attendance tracking.

## Architecture

The Church module follows the Universal Memory Cell (UMC) architecture:
- All data is stored as memories with JSONB metadata
- Uses the existing `work_memories` table
- No separate database tables for church data
- Hybrid search: SQL for structured queries, semantic for natural language

## Core Entities

### Person
- Complete profile information (name, contact, demographics)
- Membership status tracking (guest, regular, member, inactive)
- Custom fields for church-specific data
- Tags for categorization
- Ministry involvement tracking
- Attendance history

### Household
- Family unit management
- Household roles (head, spouse, child, other)
- Shared contact information
- Address management

### Ministry
- Ministry definitions and descriptions
- Role assignments (leader, member, volunteer)
- Member tracking

### Custom Fields
- Dynamically definable fields
- Support for text, number, date, boolean, select types
- Field visibility controls
- Category grouping

## MCP Tools (18 Total)

### Core Person Management (Tools 1-6)
1. **createPerson** - Create a new person record
2. **updatePerson** - Update existing person information
3. **getPerson** - Retrieve a person by ID
4. **searchPeople** - Search using natural language or filters
5. **listPeople** - List people with pagination and filters
6. **mergePeople** - Merge duplicate person records

### Household Management (Tools 7-9)
7. **createHousehold** - Create a new household
8. **updateHousehold** - Update household information
9. **addPersonToHousehold** - Add person to household with role

### Custom Fields & Tags (Tools 10-12)
10. **defineCustomField** - Create custom field definitions
11. **setPersonCustomField** - Set custom field values
12. **tagPerson** - Add, remove, or set tags

### Communication & Lists (Tools 13-15)
13. **createPeopleList** - Create filtered people lists
14. **exportPeopleData** - Export in CSV or JSON format
15. **bulkUpdatePeople** - Bulk operations on multiple people

### Ministry & Attendance (Tools 16-18)
16. **assignMinistryRole** - Assign person to ministry
17. **listMinistryMembers** - Get ministry member list
18. **trackAttendance** - Record event attendance

## Usage Examples

### Creating a Person
```javascript
{
  "firstName": "John",
  "lastName": "Smith",
  "email": "john.smith@example.com",
  "phone": "555-123-4567",
  "membershipStatus": "member",
  "tags": ["volunteer", "worship-team"],
  "customFields": {
    "baptismDate": "2020-05-15",
    "spiritualGifts": ["teaching", "leadership"]
  }
}
```

### Searching People
```javascript
// Natural language search
{
  "query": "young families with children in worship ministry"
}

// Structured filter search
{
  "filters": {
    "membershipStatus": ["member", "regular"],
    "ministries": ["worship"],
    "ageRange": { "min": 25, "max": 45 }
  }
}
```

### Creating a Household
```javascript
{
  "name": "The Smith Family",
  "address": {
    "street1": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "postalCode": "62701"
  },
  "memberIds": ["person-id-1", "person-id-2"]
}
```

## Search Capabilities

### SQL-Based Searches
- Filter by membership status
- Filter by tags and ministries
- Age range queries
- Contact information presence
- Date-based queries (created, updated, last activity)

### Semantic Searches
- Natural language queries
- Concept-based matching
- Cross-field relevance scoring

## Performance Optimizations

### Database Indexes
Recommended indexes for optimal performance:
```sql
-- Type index for fast filtering
CREATE INDEX idx_church_type ON work_memories((metadata->>'type')) 
WHERE metadata->>'type' IN ('person', 'household', 'ministry_role');

-- Membership status index
CREATE INDEX idx_church_membership ON work_memories((metadata->>'membershipStatus'))
WHERE metadata->>'type' = 'person';

-- Last name index for sorting
CREATE INDEX idx_church_lastname ON work_memories((metadata->>'lastName'))
WHERE metadata->>'type' = 'person';
```

### Query Optimizations
- Bulk operations use single transactions
- Registry pattern for managing lists
- Efficient counting queries
- Duplicate detection algorithms

## Integration Points

### With Other Modules
- Work module: Ministry projects and tasks
- Communication module: Email campaigns
- Learning module: Class attendance
- Personal module: Prayer requests

### External Systems
- Compatible with Planning Center API structure
- Export formats for common church software
- Bulk import capabilities

## Privacy & Security

### Data Protection
- Soft delete by default (mark as inactive)
- Hard delete option available
- Metadata privacy flags
- Field-level visibility controls

### Access Control
- All operations require authentication
- User-specific data isolation
- Audit trail via updatedAt timestamps

## Best Practices

### Data Entry
- Use consistent naming conventions
- Populate household relationships
- Tag people for easy filtering
- Use custom fields for church-specific data

### Performance
- Use listPeople for browsing (SQL-optimized)
- Use searchPeople for finding specific people
- Batch updates when possible
- Regular duplicate checks

### Maintenance
- Periodic duplicate person checks
- Update inactive members
- Archive old attendance records
- Review and clean up tags

## Future Enhancements

### Planned Features
- Event management integration
- Giving/donation tracking
- Small group management
- Volunteer scheduling
- Communication preferences
- Birthday/anniversary tracking

### API Extensions
- Webhook support for changes
- Bulk import improvements
- Advanced reporting tools
- Mobile app API support