# Development Commands

## Core Development
```bash
npm run dev              # Start development server with hot reload (port 3000)
npm run build            # Compile TypeScript to JavaScript
npm start                # Start production server
npm run stop             # Stop running server processes
```

## Database Management
```bash
npm run db:migrate       # Run Prisma migrations
npm run db:generate      # Generate Prisma client
npm run db:studio        # Open Prisma Studio GUI
npm run db:init          # Initialize database
npm run db:reset         # Reset database (caution!)
```

## Testing
```bash
npm test                 # Run all tests
npm run test:unit        # Run unit tests only
npm run test:integration # Run integration tests
npm run test:e2e         # Run end-to-end tests
npm run test:coverage    # Generate test coverage report
npm run test:api         # Test REST API endpoints
npm run test:mcp         # Test MCP server
```

## Code Quality
```bash
npm run lint             # Run ESLint checks
npm run lint:fix         # Auto-fix ESLint issues
npm run format           # Format code with Prettier
npm run typecheck        # Check TypeScript types
```

## Module Generation
```bash
npm run generate:module -- --name=finance --description="Financial memory module"
```

## Production/Deployment
```bash
npm run start:prod       # Start in production mode
npm run start:railway    # Railway-specific start script
```

## Utility Commands
```bash
npm run reset-password   # Reset user password
npm run get-token        # Get user authentication token
npm run cmi:populate     # Populate CMI index
```

## System Utilities (Linux)
- git, ls, cd, grep, find - Standard Linux commands
- rg (ripgrep) - Fast file search
- psql - PostgreSQL client