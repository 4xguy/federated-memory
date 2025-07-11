# MCP Server Context Engineering Framework
## Comprehensive Guide for Production-Ready Model Context Protocol Servers

---

## Context Engineering Analysis

### Project Domain Assessment
**Technical Domain:** AI Infrastructure, API Development, Cloud-Native Services  
**Core Technologies:** TypeScript, HTTP/SSE, OAuth 2.1, Railway.com  
**Complexity Rating:** 7/10 (OAuth implementation, protocol compliance, production deployment)  

### Authentication Architecture Understanding
Based on July 2025 MCP specifications:
- **OAuth 2.1 Standard:** Required for Claude.ai web integration
- **Remote MCP Support:** Claude.ai supports OAuth-authenticated remote MCP servers
- **Dual OAuth Role:** MCP server acts as both OAuth client (upstream) and OAuth provider (downstream)
- **Security Requirements:** PKCE mandatory, Dynamic Client Registration preferred

---

## Core Context Architecture (WRITE Strategy)

### 1. System Identity Framework

```typescript
// MCP Server Agent Identity
interface MCPServerAgent {
  role: "TypeScript MCP Server Developer";
  expertise: [
    "Model Context Protocol v2025-03-26",
    "OAuth 2.1 Authentication",
    "Streamable HTTP Transport",
    "Railway.com Deployment",
    "Production Security"
  ];
  personality: "systematic, security-focused, production-ready";
  decisionFramework: "spec-compliant > simple > performant";
}
```

### 2. Technical Knowledge Base

#### MCP Protocol Specifications
- **Transport:** Streamable HTTP (HTTP + Server-Sent Events)
- **Authentication:** OAuth 2.1 with PKCE (mandatory)
- **Metadata Discovery:** RFC8414 OAuth Authorization Server Metadata
- **Client Registration:** RFC7591 Dynamic Client Registration (recommended)
- **Security Baseline:** PKCE for all clients, encrypted token storage

#### Railway.com Deployment Patterns
- GitHub repo auto-deployment
- Environment variable management
- Docker containerization support
- PostgreSQL + pgvector integration
- Health check configurations

#### TypeScript MCP Libraries
- `@modelcontextprotocol/sdk-typescript` - Official MCP SDK
- `@types/node` - Node.js type definitions
- `express` - HTTP server framework
- `cors` - Cross-Origin Resource Sharing
- `helmet` - Security middleware
- `dotenv` - Environment configuration

---

## Context Selection (SELECT Strategy)

### Essential Documentation References
1. **MCP Specification:** https://modelcontextprotocol.io/
2. **OAuth 2.1 RFC:** https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1
3. **PKCE RFC:** https://datatracker.ietf.org/doc/html/rfc7636
4. **Railway.com Docs:** https://docs.railway.app/
5. **Cloudflare MCP Guide:** https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/

### Code Pattern Library

#### Basic MCP Server Structure
```typescript
import { MCPServer } from '@modelcontextprotocol/sdk-typescript/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk-typescript/server/stdio';

const server = new MCPServer(
  {
    name: "example-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  }
);
```

#### OAuth 2.1 Endpoints Pattern
```typescript
// Authorization endpoint
app.get('/oauth/authorize', (req, res) => {
  // Implement OAuth authorization flow
  // Must support PKCE code_challenge parameter
});

// Token endpoint  
app.post('/oauth/token', (req, res) => {
  // Implement token exchange
  // Must validate PKCE code_verifier
});

// Metadata endpoint (RFC8414)
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  res.json({
    issuer: process.env.BASE_URL,
    authorization_endpoint: `${process.env.BASE_URL}/oauth/authorize`,
    token_endpoint: `${process.env.BASE_URL}/oauth/token`,
    // ... other metadata
  });
});
```

### Environment Configuration Template
```bash
# Core Application
NODE_ENV=production
PORT=3000
BASE_URL=https://your-app.railway.app

# OAuth Configuration
OAUTH_CLIENT_ID=your_client_id
OAUTH_CLIENT_SECRET=your_client_secret
JWT_SECRET=your_secure_jwt_secret

# Database (if needed)
DATABASE_URL=postgresql://user:pass@host:port/db

# External APIs
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Context Compression (COMPRESS Strategy)

### Hierarchical Information Structure

#### Priority 1: Core MCP Implementation
- OAuth 2.1 authentication flow
- Streamable HTTP transport setup
- Tool/resource/prompt definitions
- Error handling and validation

#### Priority 2: Production Readiness
- Railway.com deployment configuration
- Environment variable management
- Health checks and monitoring
- CORS and security headers

#### Priority 3: Enhanced Features
- Database integration patterns
- Caching strategies
- Rate limiting
- Advanced error recovery

### Reference Compression Patterns

#### Quick Start Commands
```bash
# Project setup
npm init -y
npm install @modelcontextprotocol/sdk-typescript express cors helmet dotenv

# Railway deployment
railway login
railway init
railway up
```

#### Essential File Structure
```
src/
├── server.ts          # Main server entry
├── auth/
│   ├── oauth.ts       # OAuth 2.1 implementation
│   └── middleware.ts  # Auth middleware
├── mcp/
│   ├── tools.ts       # MCP tool definitions
│   ├── resources.ts   # MCP resource handlers
│   └── prompts.ts     # MCP prompt templates
└── utils/
    ├── config.ts      # Environment configuration
    └── logger.ts      # Logging utilities
```

---

## Context Isolation (ISOLATE Strategy)

### Scope Boundaries
- **MCP Protocol Layer:** Pure protocol implementation, no business logic
- **Authentication Layer:** OAuth flows, token management, security
- **Business Logic Layer:** Actual functionality and data processing
- **Deployment Layer:** Railway-specific configuration and environment

### Error Isolation Patterns
```typescript
// MCP Error Handling
interface MCPErrorHandler {
  protocol_errors: "Invalid MCP messages, transport failures";
  auth_errors: "OAuth failures, token validation";
  business_errors: "Application logic failures";
  infrastructure_errors: "Database, external API failures";
}
```

### Security Isolation
- OAuth tokens stored encrypted in secure storage
- Business logic separated from authentication logic
- Input validation at protocol boundary
- Rate limiting per client/token

---

## Technical Context Package

### Architecture Overview
```mermaid
graph TD
    A[Claude.ai Client] -->|OAuth 2.1| B[MCP Server on Railway]
    B --> C[Authentication Layer]
    B --> D[MCP Protocol Handler]
    D --> E[Business Logic]
    E --> F[External APIs/Database]
    
    C --> G[Token Storage]
    C --> H[PKCE Validation]
```

### Deployment Configuration

#### Railway.json
```json
{
  "deploy": {
    "startCommand": "npm run start:production",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

#### Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:production"]
```

### Testing Strategy
- OAuth flow testing with mock clients
- MCP protocol compliance testing
- Integration testing with Claude Desktop
- Load testing for production readiness

---

## Launch Prompt Template

### Complete Context-Engineered Launch Prompt

```xml
<mcp_server_development_context>

<agent_identity>
<role>Expert TypeScript MCP Server Developer</role>
<expertise>Model Context Protocol v2025-03-26, OAuth 2.1, Railway.com deployment, production security</expertise>
<approach>Specification-compliant, security-first, production-ready development</approach>
<decision_authority>Technical implementation decisions, security patterns, deployment strategies</decision_authority>
</agent_identity>

<project_specifications>
<protocol_version>MCP v2025-03-26 (Streamable HTTP)</protocol_version>
<transport>HTTP with Server-Sent Events (SSE)</transport>
<authentication>OAuth 2.1 with PKCE (mandatory for Claude.ai integration)</authentication>
<deployment_target>Railway.com with GitHub auto-deployment</deployment_target>
<programming_language>TypeScript with Node.js runtime</programming_language>
</project_specifications>

<technical_requirements>
<oauth_compliance>
- Implement OAuth 2.1 with PKCE support
- Support Dynamic Client Registration (RFC7591)
- Provide Authorization Server Metadata (RFC8414)
- Encrypted token storage with secure session management
</oauth_compliance>

<mcp_protocol_compliance>
- Implement Streamable HTTP transport (HTTP + SSE)
- Support bidirectional communication patterns
- Handle MCP message types: tools, resources, prompts
- Proper error handling and validation
</mcp_protocol_compliance>

<production_readiness>
- Railway.com deployment configuration
- Environment variable management
- Health checks and monitoring endpoints
- CORS configuration for web clients
- Security headers and middleware
</production_readiness>
</technical_requirements>

<architecture_patterns>
<folder_structure>
src/
├── server.ts (Main entry point)
├── auth/ (OAuth 2.1 implementation)
├── mcp/ (Protocol handlers)
├── utils/ (Configuration, logging)
└── types/ (TypeScript definitions)
</folder_structure>

<key_dependencies>
- @modelcontextprotocol/sdk-typescript (Official MCP SDK)
- express (HTTP server framework)
- cors (Cross-origin resource sharing)
- helmet (Security middleware)
- dotenv (Environment configuration)
</key_dependencies>

<authentication_flow>
1. Client initiates OAuth 2.1 flow with PKCE
2. Server validates and issues authorization code
3. Client exchanges code for access token
4. Server validates token on each MCP request
5. Encrypted session management for persistent access
</authentication_flow>
</architecture_patterns>

<deployment_configuration>
<railway_setup>
- GitHub repository connection
- Automatic deployment on push to main
- Environment variables via Railway dashboard
- Health check endpoint at /health
- Custom start command: npm run start:production
</railway_setup>

<environment_variables>
NODE_ENV=production
PORT=3000
BASE_URL=https://your-app.railway.app
OAUTH_CLIENT_ID=generate_secure_client_id
OAUTH_CLIENT_SECRET=generate_secure_secret
JWT_SECRET=generate_secure_jwt_secret
</environment_variables>

<security_considerations>
- HTTPS enforced for all OAuth flows
- PKCE mandatory for public clients
- Token encryption and secure storage
- Input validation at all boundaries
- Rate limiting and DDoS protection
</security_considerations>
</deployment_configuration>

<development_workflow>
<setup_steps>
1. Initialize TypeScript project with MCP dependencies
2. Implement OAuth 2.1 authentication layer
3. Create MCP protocol handlers
4. Add business logic and external integrations
5. Configure Railway deployment
6. Test with Claude Desktop and Claude.ai web
</setup_steps>

<testing_strategy>
- Unit tests for OAuth flows
- Integration tests with MCP clients
- Protocol compliance validation
- Security penetration testing
- Performance and load testing
</testing_strategy>

<deployment_steps>
1. Configure Railway.com project
2. Set environment variables
3. Connect GitHub repository
4. Deploy and monitor health checks
5. Test OAuth flow with Claude.ai
6. Validate MCP functionality
</deployment_steps>
</development_workflow>

<claude_integration>
<connection_method>Remote MCP server with OAuth 2.1</connection_method>
<client_support>Claude.ai web interface, Claude Desktop, Claude Code</client_support>
<authentication_flow>OAuth 2.1 with automatic token refresh</authentication_flow>
<testing_approach>Use Claude Desktop for development, Claude.ai web for production validation</testing_approach>
</claude_integration>

<immediate_directive>
Your first task is to create a TypeScript MCP server project structure with OAuth 2.1 authentication that can connect to Claude.ai web interface. Begin by:

1. Setting up the project with proper TypeScript configuration
2. Implementing the OAuth 2.1 authentication endpoints with PKCE support
3. Creating the basic MCP protocol handler structure
4. Configuring Railway.com deployment settings
5. Adding proper error handling and security middleware

Start by acknowledging this context and outlining your understanding of the MCP server requirements, then proceed with creating the foundational project structure.
</immediate_directive>

</mcp_server_development_context>
```

---

## Quality Assurance Checklist

### Completeness ✅
- [x] OAuth 2.1 implementation guidance
- [x] MCP protocol compliance requirements  
- [x] Railway.com deployment configuration
- [x] TypeScript development patterns
- [x] Security and production considerations

### Clarity ✅
- [x] Step-by-step development workflow
- [x] Clear architectural patterns
- [x] Specific implementation examples
- [x] Deployment instructions
- [x] Testing strategies

### Efficiency ✅
- [x] Optimized for Railway.com platform
- [x] Reusable patterns for multiple MCP servers
- [x] Streamlined authentication flow
- [x] Production-ready configuration

### Scalability ✅
- [x] Modular architecture design
- [x] Environment-based configuration
- [x] Health monitoring and logging
- [x] Rate limiting and security

### Maintainability ✅
- [x] Clear separation of concerns
- [x] TypeScript for type safety
- [x] Comprehensive error handling
- [x] Documentation and testing patterns

---

## Advanced Implementation Notes

### Multi-Server Context Management
For organizations building multiple MCP servers:
- Shared authentication infrastructure
- Common security policies
- Centralized logging and monitoring
- Standardized deployment pipelines

### Performance Optimization
- Connection pooling for database operations
- Caching strategies for frequently accessed resources
- Efficient SSE connection management
- Rate limiting and throttling

### Security Hardening
- OAuth scope validation
- Token rotation strategies
- Audit logging for all operations
- Regular security scanning and updates

This framework provides the complete context needed for any MCP server development project, ensuring production-ready implementations that integrate seamlessly with Claude.ai and other MCP clients.