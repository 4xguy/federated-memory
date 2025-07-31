# Technology Stack

## Language & Runtime
- **TypeScript** (target: ES2022)
- **Node.js** 20+ (engines requirement in package.json)

## Frameworks & Libraries
- **Express.js** - Web server framework
- **Prisma** 5.7.1 - ORM with PostgreSQL and pgvector extension support
- **OpenAI SDK** 4.24.1 - For generating embeddings
- **Model Context Protocol SDK** (@modelcontextprotocol/sdk) 1.15.1

## Database
- **PostgreSQL 16+** with pgvector extension for vector similarity search
- **Redis** (optional) - For caching and session storage
- Uses JSONB fields for flexible metadata storage

## Authentication & Security
- **JWT** (jsonwebtoken) - Token-based authentication
- **bcrypt/bcryptjs** - Password hashing
- **Passport.js** - OAuth strategies for Google and GitHub
- **Helmet** - Security headers
- **express-rate-limit** - Rate limiting

## Other Key Dependencies
- **Winston** - Logging
- **Zod** - Schema validation
- **date-fns** - Date manipulation
- **EventSource** - SSE support
- **ws** - WebSocket support

## Development Tools
- **tsx** - TypeScript execution
- **Jest** - Testing framework
- **ESLint** - Linting with TypeScript support
- **Prettier** - Code formatting