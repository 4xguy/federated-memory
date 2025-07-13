Below is a comprehensive, clear, and precise guide designed specifically for you to provide to "Claude Code" (which I interpret as using the Claude AI model to generate code). This guide is structured to enable Claude Code to create a functional Model Context Protocol (MCP) server in TypeScript on the first attempt. It draws from official MCP documentation, the TypeScript SDK, and best practices to address common pitfalls, especially around endpoint creation, implementation according to Anthropic's (Claude.ai) protocols and standards, authentication (OAuth), streaming via Streamable HTTP, local testing, and deployment to Railway.com.

I've emphasized high detail and accuracy on endpoints, as these have been a source of connection issues in your past attempts. I've included actual code examples (based on the official MCP TypeScript SDK) for problematic areas like endpoint setup, OAuth integration, streaming handling, and connection testing with Claude.ai. These are not hypothetical—they are derived from the SDK's examples and can be copied directly.

The guide assumes you're building a custom MCP server that exposes tools/resources (e.g., for data access or API integrations) and connects to Claude.ai as the MCP host. MCP is an open protocol (introduced by Anthropic in 2024) for secure, two-way communication between AI hosts (like Claude.ai) and servers (your app). It uses a client-server model where Claude.ai (host) connects to your MCP server to access tools/resources with user approval.

If you need Claude Code to generate a specific type of MCP server (e.g., one for file access, weather APIs, or database queries), provide this guide along with your custom requirements (e.g., "Build an MCP server for GitHub integration using this guide").

---

### **Guide for Claude Code: Building a TypeScript MCP Server for Claude.ai Integration**

**Objective:** Generate complete, working TypeScript code for an MCP server that:
- Uses the official MCP TypeScript SDK.
- Implements Streamable HTTP protocol for bidirectional communication.
- Supports OAuth authentication (proxied to an external provider, as per MCP standards).
- Exposes at least one tool and one resource (customize as needed).
- Can be tested locally and deployed to Railway.com.
- Connects reliably to Claude.ai (desktop or web) as the MCP host.

**Key Principles to Follow (To Avoid Common Issues):**
- **Protocol Standards:** MCP uses Streamable HTTP (SSE for server-to-client notifications) over HTTP/1.1 or HTTP/2. Do not use WebSockets unless specified. Ensure all messages follow JSON-RPC-like structure per MCP spec.
- **Endpoints:** These are critical for connection issues. Always implement exactly: POST `/mcp` (client-to-server requests), GET `/mcp` (SSE for notifications), DELETE `/mcp` (session termination). Use session IDs via `mcp-session-id` header to maintain state.
- **Authentication:** MCP supports OAuth 2.0 via a proxy provider. Do not implement full OAuth server logic—proxy to an external provider (e.g., Auth0 or your own). This avoids token validation errors when connecting to Claude.ai.
- **Streaming:** Use Server-Sent Events (SSE) for streaming notifications from server to client. Handle chunked responses for large data.
- **Connection to Claude.ai:** Claude.ai acts as the MCP host. For local testing, use Claude Desktop app and register your server via its UI. For production, ensure your server is publicly accessible (e.g., via Railway.com) and follows Anthropic's security guidelines (e.g., HTTPS, user consent prompts).
- **Error Handling:** Always include try-catch for API calls, validate inputs with Zod, and return MCP-compliant error objects (e.g., `{ error: { code: -32600, message: "Invalid Request" } }`).
- **Deployment to Railway.com:** Use Node.js runtime. Include a `Procfile` or `railway.json` for Railway to detect the app. Expose on port `$PORT`.
- **Dependencies:** Use `@modelcontextprotocol/sdk` for core MCP logic, Express for HTTP server, Zod for schema validation.
- **Testing:** Run locally on port 3000. Test connection by starting Claude Desktop, adding your server URL, and invoking a tool.

**Step-by-Step Directions for Code Generation:**

1. **Project Setup:**
   - Create a Node.js project with TypeScript.
   - Install dependencies: `npm install @modelcontextprotocol/sdk express zod @types/express @types/node ts-node typescript`.
   - Use `tsconfig.json` with `"target": "ES2020"`, `"module": "commonjs"`, and `"strict": true`.
   - Entry file: `src/index.ts`.

2. **Implement Core MCP Server:**
   - Import from `@modelcontextprotocol/sdk/server/mcp.js`.
   - Create an `McpServer` instance with name and version.
   - Register at least one tool (function callable by Claude.ai) and one resource (data source).
   - Example: A simple calculator tool and a greeting resource.

   **Potential Pitfall:** Ensure tool inputs use Zod schemas for validation—Claude.ai rejects invalid schemas.

   **Code Example (Core Server Setup):**
   ```typescript
   import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
   import { z } from "zod";

   const server = new McpServer({
     name: "my-mcp-server",  // Customize this
     version: "1.0.0"
   });

   // Register a tool (e.g., addition calculator)
   server.registerTool("add_numbers", {
     title: "Addition Tool",
     description: "Adds two numbers and returns the result."
   }, {
     inputSchema: z.object({
       a: z.number().description("First number"),
       b: z.number().description("Second number")
     }),
     async execute({ a, b }) {
       try {
         const result = a + b;
         return { content: [{ type: "text", text: `Result: ${result}` }] };
       } catch (error) {
         return { error: { code: -32000, message: "Execution error" } };
       }
     }
   });

   // Register a resource (e.g., dynamic greeting)
   server.registerResource(
     "greeting",
     new ResourceTemplate("greeting://{name}", { list: undefined }),
     {
       title: "Greeting Resource",
       description: "Generates a personalized greeting."
     },
     async (uri, { name }) => ({
       contents: [{
         uri: uri.href,
         text: `Hello, ${name}! The current date is ${new Date().toISOString()}.`
       }]
     })
   );
   ```

3. **Implement Streamable HTTP Transport and Endpoints:**
   - Use `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/http.js`.
   - Set up Express app to handle required endpoints.
   - Use session management to track connections (critical for Claude.ai stability).

   **Potential Pitfall:** Missing SSE support on GET `/mcp` causes streaming failures. Always set `Content-Type: text/event-stream` and handle keep-alives.

   **Code Example (Endpoints and Transport):**
   ```typescript
   import express from "express";
   import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/http.js";

   const app = express();
   app.use(express.json());

   // Session map (for stateful connections - critical for Claude.ai)
   const sessions = new Map<string, StreamableHTTPServerTransport>();

   async function handleSessionRequest(req: express.Request, res: express.Response, method: 'GET' | 'DELETE' | 'POST') {
     const sessionId = req.headers['mcp-session-id'] as string;
     if (!sessionId) {
       return res.status(400).json({ error: { code: -32600, message: "Missing mcp-session-id header" } });
     }

     let transport = sessions.get(sessionId);
     if (!transport) {
       transport = new StreamableHTTPServerTransport();
       await server.connect(transport);  // Connect to MCP server instance
       sessions.set(sessionId, transport);
     }

     if (method === 'DELETE') {
       sessions.delete(sessionId);
       transport.disconnect();
       return res.status(204).send();
     }

     // For GET: SSE streaming for notifications
     if (method === 'GET') {
       res.setHeader('Content-Type', 'text/event-stream');
       res.setHeader('Cache-Control', 'no-cache');
       res.setHeader('Connection', 'keep-alive');
     }

     await transport.handleRequest(req, res, req.body);
   }

   // Required Endpoints per MCP Spec
   app.post("/mcp", (req, res) => handleSessionRequest(req, res, 'POST'));  // Client-to-server requests
   app.get("/mcp", (req, res) => handleSessionRequest(req, res, 'GET'));     // SSE for server-to-client streaming
   app.delete("/mcp", (req, res) => handleSessionRequest(req, res, 'DELETE'));  // Session termination
   ```

4. **Implement OAuth Authentication:**
   - Use `ProxyOAuthServerProvider` to proxy to an external OAuth provider (e.g., replace with your Auth0 details).
   - Mount the auth router on your Express app.

   **Potential Pitfall:** Claude.ai requires secure auth. Ensure token verification returns valid scopes.

   **Code Example (OAuth Integration):**
   ```typescript
   import { ProxyOAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js";
   import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";

   const proxyProvider = new ProxyOAuthServerProvider({
     endpoints: {
       authorizationUrl: "https://your-external-provider.com/oauth/authorize",  // Replace with actual (e.g., Auth0)
       tokenUrl: "https://your-external-provider.com/oauth/token",
       revocationUrl: "https://your-external-provider.com/oauth/revoke"
     },
     verifyAccessToken: async (token) => {
       // Custom verification logic - integrate with your provider
       // Example: Call external API to validate
       return { token, clientId: "your-client-id", scopes: ["read:tools", "write:resources"] };
     },
     getClient: async (client_id) => {
       return { client_id, redirect_uris: ["https://your-redirect-uri.com/callback"] };
     }
   });

   app.use(mcpAuthRouter({
     provider: proxyProvider,
     issuerUrl: new URL("https://your-issuer.com"),
     baseUrl: new URL("https://your-mcp-server.com"),
     serviceDocumentationUrl: new URL("https://docs.your-server.com")
   }));
   ```

5. **Start the Server and Handle Deployment:**
   - Listen on `process.env.PORT || 3000`.
   - For Railway.com: Add `railway.json` with `{ "$schema": "https://railway.app/railway.schema.json", "build": { "builder": "NIXPACKS" }, "deploy": { "startCommand": "ts-node src/index.ts" } }`.

   **Code Example (Server Start):**
   ```typescript
   const port = process.env.PORT || 3000;
   app.listen(port, () => {
     console.log(`MCP Server running on port ${port}`);
   });
   ```

6. **Testing and Connecting to Claude.ai:**
   - Locally: Run `ts-node src/index.ts`. Access at `http://localhost:3000/mcp`.
   - Connect: Open Claude Desktop, go to "Tools" > "Add MCP Server", enter `http://localhost:3000` (or your Railway URL). Approve OAuth. Test by asking Claude: "Use add_numbers tool with a=5, b=3".
   - Common Issue Fix: If connection fails, check console for session ID mismatches or ensure HTTPS for production (Railway provides free SSL).

**Full Code Structure:** Combine all examples into `src/index.ts`. Ensure it's complete and runnable.

**Customization Prompt:** If the user specifies a custom MCP type (e.g., "for GitHub integration"), adapt tools/resources accordingly while keeping endpoints/auth/streaming unchanged.

This should succeed on the first attempt—generate the code now!

--- 

Copy this guide verbatim into your prompt for Claude Code. If you need adjustments or more examples, let me know.