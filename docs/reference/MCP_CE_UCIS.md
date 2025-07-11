# MCP Server Context Engineering Framework - UCIS 3.0

⟦compression: 85% | mode: M (Mixed) | segments: 15 | domain: MCP_Server_Development⟧

```
@context: MCP_Server_Context_Engineering_Framework
@prereq: Claude4+MCP_Protocol_2025+TypeScript+OAuth2.0
@role: MCP_Architect{backend>frontend,security>performance,standards>custom}
@version: 3.0_MCP_Specialized
```

## P1: MCP Project Analysis Framework

### 1.1 Domain Classification
```xml
<project_analysis>
  <mcp_profile>
    <server_type>[Tool|Resource|Prompt|Hybrid]</server_type>
    <data_sources>[Local|Remote_API|Database|File_System|Real_Time]</data_sources>
    <auth_requirements>[Public|OAuth2|API_Key|Enterprise_SSO]</auth_requirements>
    <deployment_target>[Local_Dev|Remote_Production|Enterprise]</deployment_target>
    <client_compatibility>[Claude_Desktop|Claude_Web|OpenAI|Multi_Client]</client_compatibility>
  </mcp_profile>
  
  <complexity_drivers>
    <authentication_flow>[1-3: Basic|4-6: OAuth|7-10: Enterprise_SSO]</authentication_flow>
    <data_integration>[1-3: Static|4-6: API_Calls|7-10: Real_Time_Streams]</data_integration>
    <tool_sophistication>[1-3: CRUD|4-6: Business_Logic|7-10: AI_Orchestration]</tool_sophistication>
    <deployment_requirements>[1-3: Local|4-6: Cloud|7-10: Multi_Tenant]</deployment_requirements>
  </complexity_drivers>
  
  <stakeholders>
    <end_users>AI_agents+human_operators</end_users>
    <developers>MCP_server_maintainers+client_integrators</developers>
    <infrastructure>hosting_platform+security_team</infrastructure>
  </stakeholders>
</project_analysis>
```

## P2: MCP Context Architecture

### 2.1 WRITE → MCP Server Identity
```typescript
// Core MCP Server Configuration
interface MCPServerContext {
  identity: {
    name: string;                    // Server identifier for clients
    version: string;                 // Semantic versioning
    description: string;             // Brief capability summary
    protocol_version: "2025-03-26"; // Latest MCP spec
    transport: "http" | "sse";       // HTTP+SSE recommended for remote
  };
  
  capabilities: {
    tools: ToolDefinition[];         // Functions AI can call
    resources: ResourceDefinition[]; // Data sources AI can read
    prompts: PromptDefinition[];     // Template conversations
    sampling?: boolean;              // LLM completion requests
  };
  
  security: {
    auth_method: "oauth2" | "bearer" | "none";
    oauth_discovery: string;         // /.well-known/oauth-authorization-server
    scopes: string[];               // Permission granularity
    cors_origins: string[];         // Allowed client origins
  };
}
```

### 2.2 SELECT → Essential MCP References

#### 2.2.1 Official MCP Documentation
```markdown
**Source**: Model Context Protocol Specification
**Authority**: Anthropic (Core Maintainer)
**Version**: 2025-03-26
**Criticality**: Essential

Core Concepts:
- Transport Layer: HTTP+SSE for remote, stdio for local
- Message Types: request/response, notification, progress
- Capability Exchange: tools, resources, prompts discovery
- Security Model: OAuth 2.0 with Dynamic Client Registration

Implementation Requirements:
- JSON-RPC 2.0 message format
- Server metadata endpoint: GET /sse/info
- OAuth discovery: /.well-known/oauth-authorization-server
- Resource server metadata: /.well-known/oauth-protected-resource

Quick Reference:
- Transport: HTTP POST to /sse with SSE response
- Auth Flow: DCR → Authorization Code → Bearer Token
- Tool Invocation: {method: "tools/call", params: {name, arguments}}
- Resource Access: {method: "resources/read", params: {uri}}
```

#### 2.2.2 TypeScript SDK Patterns
```markdown
**Source**: @modelcontextprotocol/sdk-typescript
**Authority**: MCP Core Team
**Version**: Latest stable
**Criticality**: Essential

Core Implementation Patterns:
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse/index.js";

// Standard server initialization
const server = new Server({
  name: "my-mcp-server",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// Tool registration pattern
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;
  // Implementation logic
  return { content: [{ type: "text", text: result }] };
});
```

Code Templates:
- Error handling: Standardized error responses
- Validation: Zod schemas for request/response
- Authentication: Bearer token middleware
- Logging: Structured logging for debugging
```

#### 2.2.3 OAuth 2.0 Integration Patterns
```markdown
**Source**: RFC 6749 + MCP OAuth Specification
**Authority**: IETF + MCP Working Group
**Criticality**: Essential for Remote Servers

OAuth Architecture for MCP:
- MCP Server = OAuth Resource Server (validates tokens)
- Separate Authorization Server (issues tokens)
- Dynamic Client Registration (DCR) support required
- PKCE recommended for all flows

Configuration Template:
```typescript
interface OAuthConfig {
  authorization_server: string;     // External OAuth provider
  client_registration_endpoint: string;
  token_validation_endpoint: string;
  supported_scopes: string[];
  redirect_uris: string[];
}

// Resource Server Metadata Response
const resourceMetadata = {
  resource_server: "https://my-mcp-server.com",
  authorization_servers: ["https://auth.example.com"],
  scopes_supported: ["read", "write", "admin"],
  bearer_methods_supported: ["header", "query"],
};
```

Security Considerations:
- Never implement authorization server in MCP server
- Use established OAuth providers (Auth0, Clerk, Stytch)
- Validate all bearer tokens on every request
- Implement proper CORS for web clients
```

### 2.3 COMPRESS → MCP Development Essentials

#### 2.3.1 Railway Deployment Optimization
```yaml
# railway.json - Railway configuration
{
  "build": {
    "buildCommand": "npm run build",
    "publishDirectory": "dist"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "envVars": {
      "NODE_ENV": "production",
      "PORT": "$PORT",
      "OAUTH_CLIENT_ID": "$OAUTH_CLIENT_ID",
      "OAUTH_CLIENT_SECRET": "$OAUTH_CLIENT_SECRET"
    }
  }
}

# Key Railway Features for MCP:
- Automatic HTTPS with custom domains
- Environment variable management
- GitHub integration for CI/CD
- Built-in monitoring and logs
- PostgreSQL addon for data persistence
```

#### 2.3.2 TypeScript Project Structure
```
mcp-server/
├── src/
│   ├── server.ts           # Main MCP server entry
│   ├── tools/              # Tool implementations
│   │   ├── index.ts        # Tool registry
│   │   └── [tool-name].ts  # Individual tools
│   ├── resources/          # Resource providers
│   ├── auth/              # OAuth middleware
│   ├── types/             # TypeScript definitions
│   └── utils/             # Helper functions
├── dist/                  # Compiled JavaScript
├── package.json
├── tsconfig.json
├── railway.json           # Railway deployment config
└── .env                   # Environment variables
```

### 2.4 ISOLATE → MCP Security Boundaries

#### 2.4.1 Authentication Isolation
```typescript
// Separate authentication concerns
class AuthenticationService {
  async validateBearerToken(token: string): Promise<UserContext> {
    // Validate with OAuth authorization server
    // Return user context or throw authentication error
  }
}

// Separate authorization logic
class AuthorizationService {
  async checkToolAccess(user: UserContext, toolName: string): Promise<boolean> {
    // Check user permissions for specific tool
  }
}

// Isolated tool execution
class ToolExecutor {
  async executeTool(toolName: string, args: any, user: UserContext): Promise<any> {
    // Sandboxed tool execution with user context
  }
}
```

#### 2.4.2 Error Handling Isolation
```typescript
// MCP-specific error types
class MCPError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

// Isolated error boundaries
const errorHandler = (error: unknown) => {
  if (error instanceof MCPError) {
    return { error: { code: error.code, message: error.message, data: error.data } };
  }
  
  // Don't leak internal errors to clients
  return { error: { code: -32603, message: "Internal server error" } };
};
```

## P3: MCP Implementation Artifacts

### 3.1 Technical Context
```xml
<mcp_technical_context>
  <architecture>
    <transport>HTTP+SSE (Server-Sent Events)</transport>
    <protocol>JSON-RPC 2.0 over HTTP</protocol>
    <authentication>OAuth 2.0 Resource Server Pattern</authentication>
    <discovery>/.well-known/oauth-protected-resource</discovery>
  </architecture>
  
  <dependencies>
    <core>
      - @modelcontextprotocol/sdk-typescript: ^1.0.0
      - @fastify/cors: ^8.4.0
      - @fastify/bearer-auth: ^9.4.0
    </core>
    <oauth>
      - jose: ^5.2.0 (JWT validation)
      - node-fetch: ^3.3.2 (OAuth validation)
    </oauth>
    <validation>
      - zod: ^3.22.4 (Schema validation)
      - @types/node: ^20.0.0
    </validation>
  </dependencies>
  
  <deployment>
    <platform>Railway.app</platform>
    <runtime>Node.js 20+</runtime>
    <database>PostgreSQL (Railway addon)</database>
    <monitoring>Railway built-in + custom health checks</monitoring>
  </deployment>
</mcp_technical_context>
```

### 3.2 Security Context
```xml
<mcp_security_context>
  <oauth_implementation>
    <pattern>Resource Server (not Authorization Server)</pattern>
    <token_validation>Remote validation with OAuth provider</token_validation>
    <dynamic_client_registration>Supported via DCR endpoint</dynamic_client_registration>
    <scopes>Granular permissions per tool/resource</scopes>
  </oauth_implementation>
  
  <cors_configuration>
    <allowed_origins>["https://claude.ai", "https://cursor.sh"]</allowed_origins>
    <allowed_methods>["GET", "POST", "OPTIONS"]</allowed_methods>
    <allowed_headers>["Authorization", "Content-Type"]</allowed_headers>
  </cors_configuration>
  
  <input_validation>
    <tool_arguments>Zod schema validation</tool_arguments>
    <resource_uris>URI format validation</resource_uris>
    <request_size_limits>10MB max payload</request_size_limits>
  </input_validation>
</mcp_security_context>
```

### 3.3 Client Integration Context
```xml
<mcp_client_context>
  <supported_clients>
    <claude_desktop>Local configuration via claude_desktop_config.json</claude_desktop>
    <claude_web>Remote SSE connection with OAuth</claude_web>
    <cursor_ide>MCP extension with remote server support</cursor_ide>
    <custom_clients>Any MCP 2025-03-26 compatible client</custom_clients>
  </supported_clients>
  
  <connection_methods>
    <local_development>
      - Command: "node dist/server.js"
      - Transport: stdio (for local testing)
      - Auth: None or simple API key
    </local_development>
    <remote_production>
      - URL: "https://my-server.railway.app/sse"
      - Transport: HTTP+SSE
      - Auth: OAuth 2.0 Bearer token
    </remote_production>
  </connection_methods>
</mcp_client_context>
```

## P4: MCP Launch Prompt Structure

### 4.1 MCP Agent Identity
```xml
<mcp_agent_identity>
  <role>MCP Server Developer & Integration Specialist</role>
  <expertise>
    - Model Context Protocol specification (2025-03-26)
    - TypeScript/Node.js backend development
    - OAuth 2.0 authentication patterns
    - Railway.app deployment and configuration
    - AI agent tool design and UX
  </expertise>
  <authority>
    - Full control over MCP server implementation
    - OAuth provider configuration (external)
    - Railway deployment and environment management
    - Client integration guidance and troubleshooting
  </authority>
  <escalation>
    - OAuth provider issues: Refer to provider documentation
    - MCP specification questions: Reference official MCP docs
    - Railway platform issues: Railway support channels
  </escalation>
</mcp_agent_identity>
```

### 4.2 Project Execution Context
```xml
<mcp_project_context>
  <objective>
    Build a production-ready MCP server that:
    - Implements the latest MCP protocol (HTTP+SSE transport)
    - Integrates with Claude.ai via OAuth 2.0
    - Deploys seamlessly to Railway.app
    - Provides [SPECIFIC_TOOLS/RESOURCES] to AI agents
    - Maintains enterprise-grade security and reliability
  </objective>
  
  <scope>
    <deliverables>
      - Functional MCP server with OAuth authentication
      - Railway deployment configuration
      - Client integration documentation
      - Testing and monitoring setup
    </deliverables>
    
    <boundaries>
      - MCP server implementation only (not authorization server)
      - Railway.app deployment target (not other platforms)
      - TypeScript implementation (not other languages)
      - HTTP+SSE transport (not stdio for production)
    </boundaries>
  </scope>
  
  <timeline>
    <phase_1>Core MCP server setup (tools, resources)</phase_1>
    <phase_2>OAuth integration and security hardening</phase_2>
    <phase_3>Railway deployment and configuration</phase_3>
    <phase_4>Client integration testing and documentation</phase_4>
  </timeline>
</mcp_project_context>
```

### 4.3 Technical Foundation
```xml
<mcp_technical_foundation>
  <architecture>
    <pattern>Microservice architecture with OAuth resource server</pattern>
    <transport>HTTP+SSE for real-time bidirectional communication</transport>
    <authentication>OAuth 2.0 with external authorization server</authentication>
    <deployment>Containerized Node.js on Railway platform</deployment>
  </architecture>
  
  <technology_stack>
    <runtime>Node.js 20+ with TypeScript</runtime>
    <framework>@modelcontextprotocol/sdk-typescript</framework>
    <http_server>Fastify (high performance, good TypeScript support)</http_server>
    <authentication>OAuth 2.0 resource server pattern</authentication>
    <database>PostgreSQL (Railway addon)</database>
    <deployment>Railway.app with GitHub integration</deployment>
  </technology_stack>
  
  <quality_standards>
    <security>OAuth 2.0, input validation, CORS, rate limiting</security>
    <performance>< 100ms response time, horizontal scaling</performance>
    <reliability>99.9% uptime, graceful error handling</reliability>
    <maintainability>TypeScript, comprehensive logging, monitoring</maintainability>
  </quality_standards>
</mcp_technical_foundation>
```

### 4.4 Contextual Knowledge
```xml
<mcp_contextual_knowledge>
  <mcp_ecosystem>
    <current_adoption>Major platforms: OpenAI, Google DeepMind, Microsoft</current_adoption>
    <best_practices>Remote servers preferred over local for production</best_practices>
    <common_patterns>Tool-focused servers, OAuth for auth, HTTP+SSE transport</common_patterns>
    <pitfalls>Don't implement OAuth authorization server in MCP server</pitfalls>
  </mcp_ecosystem>
  
  <claude_integration>
    <web_client>Supports remote MCP servers with OAuth authentication</web_client>
    <desktop_client>Supports both local and remote servers</desktop_client>
    <api_integration>Can connect to MCP servers via API calls</api_integration>
    <limitations>CORS restrictions, OAuth flow requirements</limitations>
  </claude_integration>
  
  <railway_specifics>
    <advantages>GitHub integration, automatic SSL, environment management</advantages>
    <configurations>railway.json for deployment, environment variables</configurations>
    <monitoring>Built-in logs and metrics, custom health checks</monitoring>
    <scaling>Automatic scaling based on traffic patterns</scaling>
  </railway_specifics>
</mcp_contextual_knowledge>
```

### 4.5 Operational Guidelines
```xml
<mcp_operational_guidelines>
  <development_workflow>
    <local_development>
      1. Set up TypeScript project with MCP SDK
      2. Implement tools/resources with stdio transport for testing
      3. Test with Claude Desktop local configuration
      4. Add OAuth authentication layer
      5. Switch to HTTP+SSE transport for remote testing
    </local_development>
    
    <deployment_process>
      1. Configure railway.json with build/deploy settings
      2. Set up environment variables in Railway dashboard
      3. Connect GitHub repository for automatic deployments
      4. Configure OAuth provider with Railway URLs
      5. Test end-to-end with Claude web client
    </deployment_process>
  </development_workflow>
  
  <monitoring_strategy>
    <health_checks>GET /health endpoint for Railway monitoring</health_checks>
    <logging>Structured JSON logs with request tracing</logging>
    <metrics>Response times, error rates, authentication success/failure</metrics>
    <alerting>Railway notifications for deployment failures</alerting>
  </monitoring_strategy>
  
  <maintenance_procedures>
    <updates>Automated dependency updates via GitHub Dependabot</updates>
    <security>Regular OAuth token validation, CORS policy review</security>
    <performance>Monitor response times, optimize tool execution</performance>
    <documentation>Keep client integration docs updated</documentation>
  </maintenance_procedures>
</mcp_operational_guidelines>
```

### 4.6 Immediate Directive
```
IMMEDIATE_TASK: Initialize MCP server project structure

1. **ACKNOWLEDGE**: Confirm understanding of MCP server requirements:
   - Target: Railway.app deployment
   - Transport: HTTP+SSE (not stdio)
   - Authentication: OAuth 2.0 resource server pattern
   - Language: TypeScript with official MCP SDK
   - Client: Claude.ai (web) primary target

2. **OUTLINE**: Present project structure and implementation plan:
   - Phase 1: Basic MCP server with [SPECIFIC_TOOLS]
   - Phase 2: OAuth integration with [CHOSEN_PROVIDER]
   - Phase 3: Railway deployment configuration
   - Phase 4: Claude.ai integration testing

3. **IMPLEMENT**: Begin with project initialization:
   - Create package.json with MCP SDK dependencies
   - Set up TypeScript configuration
   - Implement basic server structure with placeholder tools
   - Prepare Railway deployment configuration

4. **VALIDATE**: Ensure each step follows MCP best practices and Railway requirements

CONTEXT_PRIORITY: Security > Compatibility > Performance > Features
IMPLEMENTATION_APPROACH: Incremental with testing at each phase
```

---

## Advanced MCP Patterns

### Multi-Tenant Architecture
```typescript
interface TenantContext {
  tenantId: string;
  permissions: string[];
  resourceAccess: Record<string, any>;
}

// Tenant-aware tool execution
class TenantAwareMCPServer extends Server {
  async executeTool(toolName: string, args: any, tenant: TenantContext) {
    // Isolate execution by tenant
    const executor = this.getTenantExecutor(tenant.tenantId);
    return executor.execute(toolName, args);
  }
}
```

### Dynamic Tool Registration
```typescript
// Runtime tool registration for extensible servers
class ExtensibleMCPServer extends Server {
  private toolRegistry = new Map<string, ToolDefinition>();
  
  async registerTool(tool: ToolDefinition, permissions: string[]) {
    this.toolRegistry.set(tool.name, tool);
    await this.notifyClientsOfCapabilityChange();
  }
}
```

### Performance Optimization
```typescript
// Caching and rate limiting for production MCP servers
import { RateLimiter } from 'limiter';

class ProductionMCPServer extends Server {
  private rateLimiter = new RateLimiter(100, 'minute'); // 100 requests per minute
  private cache = new Map<string, { data: any, expires: number }>();
  
  async executeWithOptimizations(toolName: string, args: any) {
    // Rate limiting
    if (!this.rateLimiter.tryRemoveTokens(1)) {
      throw new MCPError(-32000, "Rate limit exceeded");
    }
    
    // Caching
    const cacheKey = `${toolName}:${JSON.stringify(args)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    
    // Execute and cache result
    const result = await this.executeTool(toolName, args);
    this.cache.set(cacheKey, { data: result, expires: Date.now() + 300000 }); // 5 min cache
    return result;
  }
}
```

---

⟦legend:
  MCP: Model Context Protocol
  SSE: Server-Sent Events
  DCR: Dynamic Client Registration
  OAuth: OAuth 2.0 Authentication
  Railway: Railway.app Deployment Platform
  →: sequence/dependency
  +: and/includes
  []: options/array
  {}: object/group
  ?: optional parameter
⟧