# Architecture Patterns

## Universal Memory Cell (UMC) Pattern
**CRITICAL**: The system uses a Universal Memory Cell pattern where ALL entities are stored as memories:
- No separate database tables for entities
- Two universal fields enable hybrid functionality:
  1. **EMBEDDING** (vector): 1536-dimensional for semantic search
  2. **METADATA** (JSONB): Structured data for SQL queries

## Module Architecture
1. **BaseModule Abstract Class**: All modules extend this
   - Required methods: processMetadata(), formatSearchResult()
   - Handles embedding generation and storage
   - Provides common search functionality

2. **Module Isolation**: Each module operates independently
   - Own database table (e.g., technical_memories)
   - Module-specific metadata interfaces
   - No cross-module dependencies

## Dual Embedding Strategy
- **CMI Embeddings**: 512-dimensional for fast routing
- **Module Embeddings**: 1536-dimensional for accurate search
- Compressed embeddings optimize routing performance

## Service Layer Pattern
- Services handle business logic
- Controllers handle HTTP/MCP requests
- Clear separation of concerns

## Registry Pattern
Special memories that maintain lists:
- Category Registry: List of all categories
- Type Registry: List of all memory types
- Auto-created on first use

## Authentication Pattern
- JWT tokens for API access
- BigMemory-style token URLs for Claude.ai
- OAuth support for Google/GitHub (optional)