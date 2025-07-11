# Development Environment Setup

## Prerequisites
- Node.js 20+ 
- PostgreSQL 16+
- Redis (optional)
- OpenAI API key

## Initial Setup

### 1. Clone and Install
```bash
git clone <repository-url> federated-memory
cd federated-memory
npm install
```

### 2. Database Setup
```bash
# Create database
createdb federated_memory

# Enable pgvector
psql federated_memory -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql federated_memory -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

### 3. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Required Environment Variables
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/federated_memory"

# OpenAI
OPENAI_API_KEY="sk-..."

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# Server
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET="your-secret-key"
ENCRYPTION_KEY="32-char-key"

# Modules
MODULES_PATH="./src/modules"
ACTIVE_MODULES="technical,personal,work,learning,communication,creative"
```

### 5. Development Commands
```bash
# Start development server
npm run dev

# Run tests
npm test

# Run specific module tests
npm test -- modules/technical

# Type checking
npm run typecheck

# Linting
npm run lint

# Database commands
npm run db:generate    # Generate Prisma client
npm run db:studio      # Open Prisma Studio
npm run db:reset       # Reset database

# Module generation
npm run generate:module <module-name>
```

## Docker Development

### docker-compose.yml
```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: federated_memory
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/federated_memory
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - .:/app
      - /app/node_modules

volumes:
  postgres_data:
  redis_data:
```

## VS Code Configuration

### .vscode/settings.json
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.exclude": {
    "node_modules": true,
    "dist": true,
    ".next": true
  }
}
```

### .vscode/launch.json
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "skipFiles": ["<node_internals>/**"],
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["test"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

## Module Development

### Creating a New Module
```bash
npm run generate:module -- --name=finance --description="Financial memory module"
```

This generates:
- `src/modules/finance/finance.module.ts`
- `src/modules/finance/finance.service.ts`
- `src/modules/finance/finance.schema.ts`
- `tests/modules/finance/finance.test.ts`

### Module Registration
Modules are auto-registered on startup if they're in the ACTIVE_MODULES env var.

## Testing

### Unit Tests
```bash
npm test -- --testPathPattern=unit
```

### Integration Tests
```bash
npm test -- --testPathPattern=integration
```

### E2E Tests
```bash
npm run test:e2e
```

## Performance Testing
```bash
npm run benchmark
```

## Troubleshooting

### Common Issues
1. **pgvector not found**: Make sure PostgreSQL 16+ is installed with pgvector extension
2. **Module not loading**: Check ACTIVE_MODULES env var and module exports
3. **Embedding errors**: Verify OpenAI API key and rate limits
4. **Memory leaks**: Check module disposal and connection pooling