# Church Module Tools Quick Reference

## Person Management (Tools 1-6)

### 1. createPerson
Create a new person in the church database.
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "email": "john@example.com",
  "phone": "555-1234",
  "membershipStatus": "member",
  "tags": ["volunteer"],
  "customFields": { "baptismDate": "2020-01-15" }
}
```

### 2. updatePerson
Update an existing person's information.
```json
{
  "personId": "uuid-here",
  "updates": {
    "membershipStatus": "member",
    "tags": ["volunteer", "worship-team"]
  }
}
```

### 3. getPerson
Retrieve a person by their ID.
```json
{
  "personId": "uuid-here"
}
```

### 4. searchPeople
Search for people using natural language or filters.
```json
{
  "query": "families with young children",
  "filters": {
    "membershipStatus": ["member", "regular"],
    "hasEmail": true
  },
  "limit": 20
}
```

### 5. listPeople
List people with pagination and filters.
```json
{
  "filters": {
    "membershipStatus": ["member"],
    "tags": ["volunteer"]
  },
  "sortBy": "name",
  "limit": 50,
  "offset": 0
}
```

### 6. mergePeople
Merge duplicate person records.
```json
{
  "sourceId": "uuid-to-merge-from",
  "targetId": "uuid-to-merge-into"
}
```

## Household Management (Tools 7-9)

### 7. createHousehold
Create a new household.
```json
{
  "name": "The Smith Family",
  "address": {
    "street1": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "postalCode": "62701"
  }
}
```

### 8. updateHousehold
Update household information.
```json
{
  "householdId": "uuid-here",
  "updates": {
    "name": "The Smith-Jones Family",
    "primaryContactId": "person-uuid"
  }
}
```

### 9. addPersonToHousehold
Add a person to a household.
```json
{
  "personId": "person-uuid",
  "householdId": "household-uuid",
  "role": "head"
}
```

## Custom Fields & Tags (Tools 10-12)

### 10. defineCustomField
Create a new custom field definition.
```json
{
  "name": "Spiritual Gifts",
  "type": "multiselect",
  "options": ["Teaching", "Leadership", "Service", "Hospitality"],
  "category": "Spiritual",
  "required": false
}
```

### 11. setPersonCustomField
Set a custom field value for a person.
```json
{
  "personId": "uuid-here",
  "fieldKey": "spiritual_gifts",
  "value": ["Teaching", "Leadership"]
}
```

### 12. tagPerson
Add, remove, or set tags for a person.
```json
{
  "personId": "uuid-here",
  "tags": ["volunteer", "small-group-leader"],
  "operation": "add"
}
```

## Lists & Export (Tools 13-15)

### 13. createPeopleList
Create a saved list with filters.
```json
{
  "name": "Active Volunteers",
  "description": "All active volunteers in ministries",
  "filters": {
    "tags": ["volunteer"],
    "membershipStatus": ["member", "regular"]
  }
}
```

### 14. exportPeopleData
Export people data in various formats.
```json
{
  "format": "csv",
  "filters": {
    "membershipStatus": ["member"]
  },
  "fields": ["firstName", "lastName", "email", "phone"],
  "includeCustomFields": true
}
```

### 15. bulkUpdatePeople
Update multiple people at once.
```json
{
  "operation": "tag",
  "targetIds": ["uuid1", "uuid2", "uuid3"],
  "tags": ["newsletter-subscriber"]
}
```

## Ministry & Attendance (Tools 16-18)

### 16. assignMinistryRole
Assign a person to a ministry with a specific role.
```json
{
  "personId": "uuid-here",
  "ministryName": "Worship Team",
  "role": "leader"
}
```

### 17. listMinistryMembers
Get all people in a specific ministry.
```json
{
  "ministryName": "Children's Ministry"
}
```

### 18. trackAttendance
Record attendance for a person at an event.
```json
{
  "personId": "uuid-here",
  "eventType": "service",
  "eventName": "Sunday Morning Service",
  "date": "2024-01-21T10:00:00Z",
  "status": "present"
}
```

## Common Use Cases

### Finding New Members
```json
{
  "tool": "searchPeople",
  "params": {
    "filters": {
      "membershipStatus": ["member"],
      "createdAfter": "2024-01-01"
    }
  }
}
```

### Volunteer Management
```json
{
  "tool": "listPeople",
  "params": {
    "filters": {
      "tags": ["volunteer"],
      "ministries": ["Children's Ministry", "Worship Team"]
    }
  }
}
```

### Birthday List
```json
{
  "tool": "searchPeople",
  "params": {
    "query": "birthdays this month"
  }
}
```

### Email Campaign
```json
{
  "tool": "exportPeopleData",
  "params": {
    "format": "csv",
    "filters": {
      "hasEmail": true,
      "membershipStatus": ["member", "regular"]
    },
    "fields": ["firstName", "lastName", "email"]
  }
}
```