# Code Style and Conventions

## TypeScript Configuration
- Strict mode enabled
- Target: ES2022
- Module: CommonJS
- Source maps and declarations enabled

## Code Style (from .prettierrc)
- **Semicolons**: Always use semicolons
- **Quotes**: Single quotes preferred
- **Trailing commas**: Always use trailing commas
- **Print width**: 100 characters
- **Indentation**: 2 spaces
- **Arrow functions**: Avoid parentheses for single params
- **Line endings**: LF (Unix-style)

## ESLint Rules
- Extends TypeScript recommended rules
- Explicit function return types: off (inferred)
- No explicit any: warning level
- Unused variables: error (except those prefixed with _)
- Console usage: warn (except console.warn and console.error)

## Path Aliases
The project uses TypeScript path aliases:
- `@/*` → src/*
- `@core/*` → src/core/*
- `@modules/*` → src/modules/*
- `@api/*` → src/api/*
- `@services/*` → src/services/*
- `@utils/*` → src/utils/*
- `@config/*` → src/config/*

## Naming Conventions
- Files: kebab-case (e.g., auth.service.ts)
- Classes: PascalCase (e.g., TechnicalModule)
- Interfaces: PascalCase (e.g., ModuleInfo)
- Functions/methods: camelCase
- Constants: UPPER_SNAKE_CASE

## Module Pattern
- Each module extends BaseModule abstract class
- Required methods: processMetadata(), formatSearchResult()
- Module-specific metadata interfaces