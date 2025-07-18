# Known Issues - Church Module

This document tracks known issues discovered during Church module testing and their resolution status.

## Critical Issues

### 1. cmiService.updateIndex Function Missing ❌

**Status**: Unresolved  
**Priority**: High  
**Affected Tools**: 
- `updatePerson`
- `setPersonCustomField` 
- `bulkUpdatePeople`

**Error**: 
```
Error: cmiService.updateIndex is not a function
```

**Root Cause**: The CMI service is missing the `updateIndex` method that's called when updating memory metadata.

**Impact**: Cannot update existing person records, custom fields, or perform bulk updates.

**Solution Needed**: 
1. Implement `updateIndex` method in CMI service
2. Or modify memory update flow to use existing CMI methods

**Test Case**: 
```javascript
// Fails with updateIndex error
updatePerson(personId: "afd7da4c-8118-4192-a1be-bc379f3b9d0f", updates: {lastName: "Altamirano"})
```

### 2. searchPeople Memory Search Failure ❌

**Status**: Unresolved  
**Priority**: High  
**Affected Tools**: 
- `searchPeople`

**Error**: 
```
Error searching people: Failed to search memories
```

**Root Cause**: Unknown - semantic search is failing in the Church module context.

**Impact**: Cannot perform natural language searches for people.

**Solution Needed**: 
1. Debug the search implementation in ChurchModule
2. Verify embedding generation and storage
3. Check search query construction

**Test Case**:
```javascript
// Fails with "Failed to search memories"
searchPeople(userId, { query: "people from Tepic" })
```

## Medium Priority Issues

### 3. listMinistryMembers SQL Type Error ❌

**Status**: Unresolved  
**Priority**: Medium  
**Affected Tools**: 
- `listMinistryMembers`

**Error**: 
```
operator does not exist: text = boolean
```

**Root Cause**: SQL query is comparing a text field to a boolean value incorrectly.

**Impact**: Cannot list members of a ministry.

**Solution Needed**: 
1. Fix SQL query in church-queries.ts
2. Ensure proper type casting in ministry member lookup

**Test Case**:
```javascript
// Fails with SQL type error
listMinistryMembers(userId, "Conferencia Irresistibles")
```

## Working Features ✅

### Successfully Tested Tools

1. **`createPerson`** ✅ - Created César Omar Altamira and Perla Plantillas
2. **`listPeople`** ✅ - Retrieved people with tag filtering
3. **`getPerson`** ✅ - Retrieved individual person details
4. **`assignMinistryRole`** ✅ - Assigned people to "Conferencia Irresistibles" ministry
5. **`defineCustomField`** ✅ - Created "preferred_session_time" custom field
6. **`trackAttendance`** ✅ - Recorded conference attendance

### Test Data Successfully Created

**Person 1: César Omar Altamira**
- **ID**: `afd7da4c-8118-4192-a1be-bc379f3b9d0f`
- **Email**: cesile12@hotmail.com
- **Location**: Tepic, Nayarit, México
- **Ministry**: Conferencia Irresistibles (member)
- **Note**: Last name needs correction to "Altamirano"

**Person 2: Perla Plantillas**  
- **ID**: `9e391674-fab3-4214-b7a6-5829d317afcb`
- **Email**: perlaplan@hotmail.com
- **Location**: Tepic, Nayarit, México
- **Ministry**: Conferencia Irresistibles (member)

**Custom Field**: `preferred_session_time` (select type with options: Mañana, Tarde, Noche)

## Resolution Priority

### Immediate (This Sprint)
1. **Fix updateIndex function** - Blocks all update operations
2. **Fix searchPeople** - Core functionality for people management

### Next Sprint  
3. **Fix listMinistryMembers SQL** - Important for ministry management
4. **Add comprehensive error handling** - Improve user experience

### Future
5. **Performance optimization** - Add database indexes
6. **Comprehensive testing** - Unit and integration tests

## Debugging Notes

### For updateIndex Issue
- Check if CMI service needs method implementation
- Verify if other modules have similar update patterns  
- Consider alternative update flows that don't require updateIndex

### For searchPeople Issue
- Test semantic search in isolation
- Verify embedding generation works for person content
- Check if ChurchModule.search method is implemented correctly

### For listMinistryMembers Issue  
- Review SQL query type casting in church-queries.ts
- Ensure ministry assignment storage format is consistent
- Test ministry query patterns

## Test Environment
- **System**: Federated Memory System v1.0
- **Module**: Church People Management
- **Authentication**: Token-based (Claude.ai integration)
- **Database**: PostgreSQL with pgvector
- **Test Data**: Conference registration data from Tepic, Nayarit

---

*Last Updated: 2025-01-18*  
*Next Review: After critical issues resolution*