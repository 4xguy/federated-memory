# MCP Server Development: Comprehensive Reference Guide
*Consolidated from Official Specifications and Best Practices - July 2025*

---

## Table of Contents
1. [Model Context Protocol (MCP) Specification](#mcp-specification)
2. [OAuth 2.1 Authentication Framework](#oauth-21-framework)
3. [PKCE (Proof Key for Code Exchange)](#pkce-implementation)
4. [Railway.com Deployment Guide](#railway-deployment)
5. [TypeScript Implementation Patterns](#typescript-patterns)
6. [Security & Best Practices](#security-practices)

---

## MCP Specification

### Overview
Model Context Protocol (MCP) is an open protocol that enables seamless integration between LLM applications and external data sources and tools. MCP provides a standardized way to connect AI models to different data sources and tools, following a client-server architecture where a host application can connect to multiple servers.

### Core Architecture Components

#### MCP Roles
- **MCP Hosts:** Programs like Claude Desktop, IDEs, or AI tools that want to access data through MCP
- **MCP Clients:** Connectors within the host application (1:1 relationship with servers)
- **MCP Servers:** Lightweight programs that expose specific capabilities through the standardized protocol

#### Communication Protocol
Built on JSON-RPC 2.0, MCP provides a stateful session protocol focused on context exchange and sampling coordination between clients and servers.

### MCP Capabilities

#### 1. Tools (Model-controlled)
- Functions that AI models can call to perform specific actions
- Examples: weather API, database queries, file operations
- Require explicit user consent before execution

#### 2. Resources (Application-controlled)
- Data sources that AI models can access
- Similar to GET endpoints in a REST API
- Provide data without significant computation or side effects

#### 3. Prompts (User-controlled)
- Pre-defined templates to use tools or resources optimally
- Selected before running inference
- Available as slash commands in compatible clients

### Transport Mechanisms

#### Streamable HTTP (Recommended for Remote Servers)
The latest MCP specification (2025-03-26) introduces Streamable HTTP transport, combining HTTP with Server-Sent Events (SSE) for flexible bidirectional communication.

### Protocol Flow
1. **Initialization:** Host creates MCP clients, exchange capabilities via handshake
2. **Discovery:** Clients request server capabilities (tools, resources, prompts)
3. **Registration:** Clients register capabilities for AI model use
4. **Execution:** AI model selects and uses capabilities with user approval

---

## OAuth 2.1 Framework

### Overview
OAuth 2.1 consolidates changes from OAuth 2.0 extensions to simplify the core document. The major difference is that PKCE is required for all OAuth clients using the authorization code flow.

### Key Changes from OAuth 2.0

- **PKCE Required:** Mandatory for all authorization code flows
- **Exact String Matching:** Redirect URIs must be compared using exact string matching
- **Implicit Grant Removed:** The Implicit grant (response_type=token) is omitted
- **Password Grant Removed:** Resource Owner Password Credentials grant is omitted
- **Bearer Token Security:** Omits bearer tokens in query strings
- **Refresh Token Security:** Public client refresh tokens must be sender-constrained or one-time use


### Client Types

- **Confidential Clients:** Have credentials that uniquely identify them (web applications on servers)
- **Public Clients:** Clients without credentials (mobile apps, SPAs)


### Authorization Code Flow (OAuth 2.1 Standard)
```
+--------+                                +---------------+
|        |--(A)- Authorization Request ->|   Resource    |
|        |       + PKCE parameters       |     Owner     |
|        |<-(B)-- Authorization Grant ---|               |
|        |                               +---------------+
|        |
|        |                               +---------------+
|        |--(C)-- Authorization Grant -->| Authorization |
| Client |       + PKCE code_verifier    |     Server    |
|        |<-(D)----- Access Token -------|               |
|        |                               +---------------+
+--------+
```

### Required OAuth 2.1 Endpoints

#### Authorization Endpoint
- **Purpose:** Initiate authorization flow
- **PKCE Requirements:** Must accept `code_challenge` and `code_challenge_method`
- **Redirect Validation:** Exact string matching required

#### Token Endpoint
- **Purpose:** Exchange authorization code for access token
- **PKCE Validation:** Must verify `code_verifier` against stored `code_challenge`

#### Authorization Server Metadata (RFC8414)
Servers SHOULD support OAuth 2.0 Authorization Server Metadata, allowing clients to discover OAuth endpoints automatically.

**Endpoint:** `/.well-known/oauth-authorization-server`

**Required Metadata:**
```json
{
  "issuer": "https://your-server.com",
  "authorization_endpoint": "https://your-server.com/oauth/authorize",
  "token_endpoint": "https://your-server.com/oauth/token",
  "code_challenge_methods_supported": ["S256"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"]
}
```

---

## PKCE Implementation

### Overview
PKCE (Proof Key for Code Exchange, pronounced "pixie") is an extension to the authorization code flow to prevent CSRF and authorization code injection attacks. PKCE is not a replacement for client authentication and is recommended even for confidential clients.

### PKCE Protocol Flow

1. Client creates a cryptographically random `code_verifier`
2. Client derives `code_challenge` using SHA256: `code_challenge = BASE64URL(SHA256(code_verifier))`
3. Client sends `code_challenge` and `code_challenge_method=S256` with authorization request
4. Authorization server stores `code_challenge` with issued authorization code
5. Client sends `code_verifier` with token request
6. Server validates: `BASE64URL(SHA256(code_verifier)) == stored_code_challenge`


### Implementation Requirements

#### Code Verifier

- **Length:** 43-128 characters
- **Character Set:** `[A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"`
- **Entropy:** Must be cryptographically random with high entropy


#### Code Challenge Methods
- **S256 (REQUIRED):** `BASE64URL(SHA256(ASCII(code_verifier)))`
- **plain (NOT RECOMMENDED):** `code_challenge = code_verifier`

### TypeScript PKCE Implementation
```typescript
import crypto from 'crypto';

// Generate code verifier
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// Generate code challenge
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

// Authorization URL construction
function buildAuthUrl(clientId: string, redirectUri: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'read write'
  });
  
  return `https://auth-server.com/oauth/authorize?${params}`;
}
```

---

## Railway Deployment

### Overview
Railway is an infrastructure platform where you can provision infrastructure, develop locally, and deploy to the cloud. Railway automates Node.js deployment by detecting package.json files, managing npm installations, and handling process management.

### Deployment Methods

#### 1. GitHub Integration (Recommended)
Connect your GitHub repository for automatic deployment on every push to your selected branch.

#### 2. CLI Deployment
```bash
# Install Railway CLI
npm install -g @railway/cli

# Initialize and deploy
railway login
railway init
railway up

# Set custom domain
railway domain
```

### Environment Variables

#### Setting Variables
Variables can be defined at service level (Variables tab) or project level (Shared Variables). Variables are made available at runtime as environment variables.

#### Sealed Variables
Railway provides sealed variables for extra security - values are provided to builds but never visible in UI. Sealed variables cannot be un-sealed and are not copied to PR environments.

#### Essential MCP Server Variables
```bash
# Core Application
NODE_ENV=production
PORT=3000
BASE_URL=https://your-app.railway.app

# OAuth Configuration
OAUTH_CLIENT_ID=your_client_id
OAUTH_CLIENT_SECRET=your_secret  # Use sealed variable
JWT_SECRET=your_jwt_secret       # Use sealed variable

# Database (if needed)
DATABASE_URL=postgresql://user:pass@host:port/db

# External APIs
OPENAI_API_KEY=sk-...           # Use sealed variable
```

### TypeScript Project Configuration

#### package.json Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node-dev src/index.ts",
    "railway:start": "npm run build && npm start"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```


#### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Railway Configuration Files

#### railway.json (Optional)
```json
{
  "deploy": {
    "startCommand": "npm run railway:start",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

#### Dockerfile (Alternative to Nixpacks)
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]
```

---

## TypeScript Patterns

### MCP Server Base Structure
```typescript
import { MCPServer } from '@modelcontextprotocol/sdk-typescript/server';
import { HTTPServerTransport } from '@modelcontextprotocol/sdk-typescript/server/http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://claude.ai'],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// MCP Server initialization
const server = new MCPServer(
  {
    name: 'my-mcp-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  }
);

// OAuth endpoints
app.get('/oauth/authorize', handleAuthorization);
app.post('/oauth/token', handleTokenExchange);
app.get('/.well-known/oauth-authorization-server', handleMetadata);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
});
```

### OAuth Implementation Pattern
```typescript
interface OAuthTokenRequest {
  grant_type: 'authorization_code';
  code: string;
  redirect_uri: string;
  client_id: string;
  code_verifier: string;
}

interface OAuthTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

// Token validation middleware
const validateBearerToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'invalid_token' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'invalid_token' });
  }
};
```

### Error Handling Pattern
```typescript
// MCP Error types
enum MCPErrorCode {
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  PARSE_ERROR = -32700
}

interface MCPError {
  code: MCPErrorCode;
  message: string;
  data?: any;
}

// Global error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', error);
  
  const mcpError: MCPError = {
    code: MCPErrorCode.INTERNAL_ERROR,
    message: 'Internal server error',
    data: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };
  
  res.status(500).json({ error: mcpError });
});
```

---

## Security Practices

### Authentication Security

#### OAuth 2.1 Requirements

- **PKCE Mandatory:** All clients must implement PKCE for security baseline
- **Dynamic Client Registration:** Servers SHOULD support RFC7591
- **Authorization Server Metadata:** Servers SHOULD support RFC8414 for endpoint discovery


#### Token Security
- **Encrypted Storage:** Store access tokens encrypted in secure storage (Workers KV, database)
- **Short Expiration:** Access tokens should have short lifetimes (1-24 hours)
- **Refresh Token Rotation:** Implement one-time use refresh tokens for public clients
- **Secure Transport:** Always use HTTPS for all OAuth flows

### MCP Security Principles

#### User Consent and Control

- Users must explicitly consent to and understand all data access and operations
- Users must retain control over what data is shared and what actions are taken
- Provide clear UIs for reviewing and authorizing activities


#### Tool Safety

- Tools represent arbitrary code execution and must be treated with appropriate caution
- Hosts must obtain explicit user consent before invoking any tool
- Tool descriptions should be considered untrusted unless from trusted servers


#### Data Privacy

- Hosts must obtain explicit user consent before exposing user data to servers
- User data should be protected with appropriate access controls
- Must not transmit resource data elsewhere without user consent


### Implementation Security Checklist

#### Input Validation
```typescript
import Joi from 'joi';

const authRequestSchema = Joi.object({
  response_type: Joi.string().valid('code').required(),
  client_id: Joi.string().required(),
  redirect_uri: Joi.string().uri().required(),
  code_challenge: Joi.string().base64().required(),
  code_challenge_method: Joi.string().valid('S256').required(),
  scope: Joi.string().optional(),
  state: Joi.string().optional()
});

// Validate requests
const { error, value } = authRequestSchema.validate(req.query);
if (error) {
  return res.status(400).json({ error: 'invalid_request' });
}
```

#### Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'too_many_requests' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/oauth/authorize', authLimiter);
app.use('/oauth/token', authLimiter);
```

#### CORS Configuration
```typescript
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Check against allowlist
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### Production Security Headers
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## Integration Testing

### MCP Client Testing
```typescript
// Test MCP protocol compliance
import { MCPTestClient } from '@modelcontextprotocol/sdk-typescript/testing';

describe('MCP Server Integration', () => {
  let client: MCPTestClient;
  
  beforeEach(async () => {
    client = new MCPTestClient('http://localhost:3000');
    await client.connect();
  });
  
  test('should discover server capabilities', async () => {
    const capabilities = await client.getCapabilities();
    expect(capabilities.tools).toBeDefined();
    expect(capabilities.resources).toBeDefined();
    expect(capabilities.prompts).toBeDefined();
  });
  
  test('should handle tool execution', async () => {
    const result = await client.callTool('test-tool', { param: 'value' });
    expect(result.success).toBe(true);
  });
});
```

### OAuth Flow Testing
```typescript
// Test OAuth 2.1 with PKCE
describe('OAuth 2.1 Flow', () => {
  test('should complete authorization code flow with PKCE', async () => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    // Step 1: Authorization request
    const authUrl = buildAuthUrl('test-client', 'http://localhost:3000/callback', codeChallenge);
    const authResponse = await fetch(authUrl);
    expect(authResponse.status).toBe(302);
    
    // Step 2: Extract authorization code
    const location = authResponse.headers.get('location');
    const code = new URL(location!).searchParams.get('code');
    
    // Step 3: Token exchange
    const tokenResponse = await fetch('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code!,
        redirect_uri: 'http://localhost:3000/callback',
        client_id: 'test-client',
        code_verifier: codeVerifier
      })
    });
    
    const tokens = await tokenResponse.json();
    expect(tokens.access_token).toBeDefined();
    expect(tokens.token_type).toBe('Bearer');
  });
});
```

---

## Quick Reference Commands

### Development Setup
```bash
# Initialize TypeScript MCP project
npm init -y
npm install @modelcontextprotocol/sdk-typescript express cors helmet dotenv
npm install -D typescript @types/node @types/express ts-node-dev

# Initialize TypeScript
npx tsc --init

# Start development server
npm run dev
```

### Railway Deployment
```bash
# Deploy to Railway
railway login
railway init
railway up

# Set environment variables
railway variables set NODE_ENV=production
railway variables set OAUTH_CLIENT_SECRET=secret --sealed

# View logs
railway logs
```

### Security Testing
```bash
# Test OAuth endpoints
curl -X GET "https://your-app.railway.app/.well-known/oauth-authorization-server"

# Test PKCE flow
curl -X POST "https://your-app.railway.app/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=CODE&code_verifier=VERIFIER"
```

---

*This reference guide consolidates information from official MCP specifications, OAuth 2.1 RFC, PKCE RFC, Railway documentation, and security best practices. Use this as your primary reference to minimize online searches during MCP server development.*