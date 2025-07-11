# Federated Memory System - Project Structure

```
federated-memory/
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── tsconfig.json
├── jest.config.js
├── docker-compose.yml
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── src/
│   ├── index.ts                 # Main entry point
│   ├── config/
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   └── modules.ts
│   │
│   ├── core/
│   │   ├── cmi/                 # Central Memory Index
│   │   │   ├── index.service.ts
│   │   │   ├── router.service.ts
│   │   │   ├── relationships.service.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── modules/             # Module framework
│   │   │   ├── base.module.ts
│   │   │   ├── loader.service.ts
│   │   │   ├── registry.service.ts
│   │   │   └── interfaces.ts
│   │   │
│   │   └── embeddings/
│   │       ├── generator.service.ts
│   │       ├── compressor.service.ts
│   │       └── cache.service.ts
│   │
│   ├── modules/                 # Actual modules
│   │   ├── technical/
│   │   │   ├── technical.module.ts
│   │   │   ├── technical.service.ts
│   │   │   └── technical.schema.ts
│   │   │
│   │   ├── personal/
│   │   ├── work/
│   │   ├── learning/
│   │   ├── communication/
│   │   └── creative/
│   │
│   ├── api/
│   │   ├── rest/
│   │   │   ├── memory.controller.ts
│   │   │   ├── module.controller.ts
│   │   │   └── search.controller.ts
│   │   │
│   │   ├── mcp/
│   │   │   ├── server.ts
│   │   │   ├── handlers.ts
│   │   │   └── tools.ts
│   │   │
│   │   └── middleware/
│   │       ├── auth.middleware.ts
│   │       ├── rateLimit.middleware.ts
│   │       └── error.middleware.ts
│   │
│   ├── services/
│   │   ├── search/
│   │   │   ├── federated.search.ts
│   │   │   ├── query.classifier.ts
│   │   │   └── result.merger.ts
│   │   │
│   │   ├── auth/
│   │   └── monitoring/
│   │
│   └── utils/
│       ├── logger.ts
│       ├── validators.ts
│       └── helpers.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── scripts/
│   ├── setup-db.sh
│   ├── migrate.ts
│   └── generate-module.ts
│
└── docs/
    ├── architecture.md
    ├── module-development.md
    └── api-reference.md
```