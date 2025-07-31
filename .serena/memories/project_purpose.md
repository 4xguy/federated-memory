# Federated Memory System

## Purpose
A universal memory architecture for LLMs with distributed storage, intelligent routing, and full BigMemory compatibility. Built for LLMs with MCP (Model Context Protocol) integration.

## Key Features
- **Universal Memory Architecture**: All data (projects, tasks, categories) stored as memories with JSONB metadata
- **Central Memory Index (CMI)**: Lightning-fast routing with 512-dimensional embeddings  
- **7 Memory Modules**: Technical, Personal, Work, Learning, Communication, Creative, Church
- **BigMemory Tool Parity**: Complete implementation of all 18 BigMemory MCP tools
- **Token-Based Authentication**: Simple token URLs for Claude.ai integration (no OAuth required)
- **pgvector Integration**: Semantic search using PostgreSQL's vector extension
- **High Performance**: Sub-200ms federated search latency

## Available Tools
- 36 Total Tools (18 Core + 18 Church)
- Core tools include: searchMemory, storeMemory, listModules, getModuleStats, project/task management
- Church tools include: person management, household management, custom fields, ministry roles

## Target Use Case
External memory system for AI assistants to store and retrieve contextual information across different domains (technical knowledge, personal data, work projects, etc.)