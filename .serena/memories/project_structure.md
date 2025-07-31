# Project Structure

## Root Directory
```
federated-memory/
├── src/                    # Source code
├── prisma/                 # Database schema and migrations
├── tests/                  # Test suites
├── docs/                   # Documentation
├── scripts/                # Utility scripts
├── public/                 # Static files
├── frontend/               # Frontend code
└── backups/                # Backup files
```

## Source Structure (src/)
```
src/
├── core/                   # Core systems
│   ├── cmi/                # Central Memory Index
│   ├── embeddings/         # Embedding generation
│   └── modules/            # Module system base classes
├── modules/                # Memory module implementations
│   ├── technical/          # Technical knowledge module
│   ├── personal/           # Personal data module
│   ├── work/               # Work/projects module
│   ├── learning/           # Learning module
│   ├── communication/      # Communication module
│   ├── creative/           # Creative ideas module
│   ├── church/             # Church CRM module
│   └── project-management/ # Project management module
├── api/                    # API endpoints
│   ├── rest/               # REST API routes
│   ├── mcp/                # MCP server implementation
│   ├── sse/                # Server-sent events
│   └── middleware/         # Express middleware
├── services/               # Business logic services
│   ├── auth.service.ts     # Authentication
│   ├── church.service.ts   # Church operations
│   └── project-management.service.ts
├── utils/                  # Utility functions
├── config/                 # Configuration files
└── types/                  # TypeScript type definitions
```

## Key Files
- `index.ts` - Main entry point
- `prisma/schema.prisma` - Database schema
- `CLAUDE.md` - Project-specific AI instructions
- `.env` - Environment variables (not in git)