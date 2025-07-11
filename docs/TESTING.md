# Testing the Technical Module

This guide walks through testing the Technical Module before implementing the remaining modules.

## Prerequisites

1. **PostgreSQL with pgvector**
   ```bash
   # Create database
   createdb federated_memory
   
   # Enable pgvector extension
   psql federated_memory -c "CREATE EXTENSION IF NOT EXISTS vector;"
   ```

2. **Environment Setup**
   ```bash
   # Copy example env file
   cp .env.example .env
   
   # Edit .env with your actual values:
   # - DATABASE_URL with your PostgreSQL connection
   # - OPENAI_API_KEY with your OpenAI API key
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

## Testing Steps

### 1. Run Database Migrations
```bash
npm run db:migrate
```

This creates all necessary tables with pgvector support.

### 2. Setup Test Database
```bash
npm run test:setup
```

This script:
- Verifies database connection
- Checks pgvector extension
- Creates a test user
- Registers the technical module

### 3. Run Technical Module Test
```bash
npm run test:module
```

This comprehensive test:
1. Stores TypeScript error memories
2. Stores code snippet memories
3. Searches for specific patterns
4. Tests metadata filtering
5. Updates existing memories
6. Gets module statistics
7. Tests CMI routing
8. Performs federated search
9. Deletes memories

## Expected Output

You should see output like:
```
[2024-01-10 10:30:00] [info]: Starting Technical Module test...
[2024-01-10 10:30:01] [info]: Technical Module initialized successfully

=== Test 1: Storing TypeScript error memory ===
[2024-01-10 10:30:02] [info]: Stored error memory with ID: 123e4567-e89b-12d3-a456-426614174000

=== Test 2: Storing code snippet memory ===
[2024-01-10 10:30:03] [info]: Stored code snippet memory with ID: 987fcdeb-51a2-43f1-b123-5678901234cd

...

✅ All tests completed successfully!
```

## Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: Ensure PostgreSQL is running and DATABASE_URL is correct.

### pgvector Extension Missing
```
❌ pgvector extension not found
```
**Solution**: Install pgvector and create the extension:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### OpenAI API Error
```
Error: Invalid API Key provided
```
**Solution**: Check your OPENAI_API_KEY in the .env file.

### Table Missing Errors
```
relation "technical_memories" does not exist
```
**Solution**: Run migrations:
```bash
npm run db:migrate
```

## Manual Testing

You can also test manually using the development server:

```bash
# Start the server
npm run dev

# In another terminal, test the health endpoint
curl http://localhost:3000/health
```

## Next Steps

Once the Technical Module is working correctly:
1. The module serves as a template for other modules
2. The same testing approach can be used for each new module
3. Integration tests can be added to test inter-module communication