# Comprehensive Guide to Building a Universal Model Context Protocol (MCP) Server

This document compiles essential, up-to-date information from reliable sources on the Model Context Protocol (MCP), focusing on creating a robust, error-free MCP server. The goal is to equip an AI coding agent with all necessary details to implement the server on the first attempt. The server will use the latest streaming-HTTP transport, incorporate OAuth for tool authorization (specifically GitHub and Google), include a custom OAuth authentication system where feasible, ensure universality for LLMs supporting MCP, and prioritize compatibility with the Claude.ai online version. All information is drawn from official documentation, tutorials, and announcements as of July 12, 2025.

## 1. Introduction to Model Context Protocol (MCP)

MCP is an open-source protocol introduced by Anthropic in November 2024, designed to standardize connections between AI applications (like LLMs) and external data sources or tools.<grok:render card_id="c44682" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">1</argument></grok:render> It acts as a "USB-C port for AI," enabling secure, two-way integrations without fragmented custom setups.<grok:render card_id="0d0a9b" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">0</argument></grok:render> MCP addresses AI isolation from data silos, allowing LLMs to access real-time information from repositories, APIs, databases, and more.<grok:render card_id="b06459" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">82</argument></grok:render>

Key goals:
- Simplify scaling AI integrations.
- Enable context maintenance across tools.
- Support agentic workflows where LLMs can read, write, or act on data.

MCP is universal: Any LLM host implementing the MCP client can connect, including local models like Llama 3.2 or cloud-based ones like Claude.<grok:render card_id="f08c04" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">3</argument></grok:render> Pre-built servers exist for tools like GitHub, Google Drive, Slack, and Postgres, but this guide focuses on a custom server.<grok:render card_id="5a468e" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">82</argument></grok:render>

## 2. MCP Architecture and Protocol Overview

MCP uses a client-server model:
- **MCP Host/Client**: The AI application (e.g., Claude.ai or a local LLM interface) that initiates connections and sends requests.
- **MCP Server**: A lightweight program exposing tools/data via standardized endpoints. It handles requests, authenticates if needed, and returns structured responses.
- **Data Sources**: Local (files, databases) or remote (APIs like GitHub/Google) accessed securely.

Protocol flow:
1. The LLM host connects to the MCP server.
2. The server provides tool definitions (e.g., JSON schemas for functions like "get_github_repo").
3. The LLM invokes tools via requests.
4. The server executes, authorizes (e.g., via OAuth), and streams responses back.

Security emphasizes user-controlled access: Servers only access what the user permits, with best practices for prompt injection prevention and data isolation.<grok:render card_id="40ec9c" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">81</argument></grok:render> For universality, adhere to the open spec at modelcontextprotocol.io, ensuring no vendor-specific extensions.

## 3. Streaming-HTTP Transport: The Latest Protocol

MCP initially used Server-Sent Events (SSE) but switched to Streamable HTTP in March 2025 for better stability, performance, and simplicity.<grok:render card_id="53cc6b" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">31</argument></grok:render> Streamable HTTP uses a single HTTP endpoint for bidirectional communication, reducing client complexity and improving real-time streaming for AI responses.<grok:render card_id="db2fb8" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">79</argument></grok:render>

Benefits over SSE:
- **Stability**: Handles network interruptions better.
- **Performance**: Lower latency for large data streams.
- **Ease**: Single endpoint vs. separate SSE channels; backward-compatible.

Implementation in Python (using MCP SDK):
- Use `mcp.server.fastmcp` for async handling.
- Set `transport='http'` in server run config.
- Handle requests with `httpx.AsyncClient` for streaming responses (e.g., chunked transfers).
- Upgrade example: Replace SSE endpoints with a unified `/mcp` POST endpoint for messages; add streaming support via `response.iter_bytes()`.

Code snippet for basic streaming HTTP server:
```python
from mcp.server.fastmcp import FastMCP
import httpx

mcp = FastMCP("universal-mcp-server")

async def stream_response(url: str):
    async with httpx.AsyncClient() as client:
        async with client.stream("GET", url) as response:
            async for chunk in response.aiter_bytes():
                yield chunk

@mcp.tool()
async def example_tool(param: str) -> str:
    # Stream data from external API
    return "Streamed response"

if __name__ == "__main__":
    mcp.run(transport='http', port=8080)  # Use HTTP transport
```
<grok:render card_id="e0e18f" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">83</argument></grok:render> Ensure timeouts (e.g., 30s) and error handling for streams.

## 4. Building the MCP Server: Step-by-Step

Use Python with the MCP SDK (v1.5.0+) for implementation.<grok:render card_id="0067e4" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">80</argument></grok:render> Prerequisites: Python 3.10+, `pip install mcp[cli] httpx`.

Steps:
1. **Setup Project**: Create a virtual env, install deps (`uv add "mcp[cli]" httpx`).
2. **Initialize Server**: Import `FastMCP`, define tools with `@mcp.tool()` decorators. Tools auto-generate schemas from type hints/docstrings.
3. **Define Tools**: Include GitHub/Google access tools (see Section 5).
4. **Add Authentication**: Implement custom OAuth (Section 6).
5. **Run Server**: Use `mcp.run(transport='http')` for remote; test locally first.
6. **Test**: Connect via Claude.ai or local LLM; verify tool invocation.

Example tools: `ls` (list files), `cat` (read file), custom ones for GitHub/Google.<grok:render card_id="c501d8" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">80</argument></grok:render>

Full server code skeleton:
```python
from typing import Any
from mcp.server.fastmcp import FastMCP
import httpx

mcp = FastMCP("universal-mcp")

@mcp.tool()
async def get_github_repo(repo: str) -> str:
    # OAuth-authorized GitHub API call (details in Section 5)
    return "Repo data"

if __name__ == "__main__":
    mcp.run(transport='http', host='0.0.0.0', port=8080)
```
<grok:render card_id="fdead6" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">83</argument></grok:render>

## 5. OAuth for Tool Authorization (GitHub and Google)

Tools must use OAuth 2.0 to authorize access without sharing credentials.<grok:render card_id="34f760" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">85</argument></grok:render> Implement per-tool flows.

### GitHub OAuth
- Register app at GitHub Developer Settings; get client_id/secret.
- Web flow: Redirect to `https://github.com/login/oauth/authorize?client_id=ID&scope=repo user`.
- Exchange code for token via POST to `https://github.com/login/oauth/access_token`.
- Scopes: `repo` for repos, `user` for profiles.
- Device flow for headless: Poll for codes.

Code example:
```python
async def github_oauth(code: str):
    data = {'client_id': 'ID', 'client_secret': 'SECRET', 'code': code}
    response = await httpx.post('https://github.com/login/oauth/access_token', data=data)
    return response.json()['access_token']
```
<grok:render card_id="d5ac02" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">85</argument></grok:render> Use token in headers: `Authorization: Bearer TOKEN`.

### Google OAuth
- Create credentials in Google Console; download client_secret.json.
- Flow: Redirect to `https://accounts.google.com/o/oauth2/v2/auth?scope=drive&access_type=offline`.
- Exchange code for tokens; use refresh tokens for persistence.

Code example (using google-auth-oauthlib):
```python
from google_auth_oauthlib.flow import Flow

flow = Flow.from_client_secrets_file('client_secret.json', scopes=['https://www.googleapis.com/auth/drive'])
authorization_url = flow.authorization_url()
# After redirect, exchange code
tokens = flow.fetch_token(code='CODE')
```
<grok:render card_id="99caad" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">87</argument></grok:render> Integrate into tools: Store tokens securely, refresh as needed.

| Aspect | GitHub | Google |
|--------|--------|--------|
| Endpoint | github.com/login/oauth | accounts.google.com/o/oauth2 |
| Scopes | repo, user | drive, calendar |
| Flow Type | Web/Device | Web/Server-to-Server |
| Token Lifespan | Variable | Access: 1h, Refresh: Long |

## 6. Implementing Custom OAuth Authentication System

For server authentication (feasible for remote setups), create a custom OAuth2 server using Ory Hydra (open-source).<grok:render card_id="c08441" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">86</argument></grok:render> This authenticates LLM clients before tool access.

Steps:
1. Install Ory CLI.
2. Create project: `ory create project`.
3. Register clients for flows (client_credentials, authorization_code).
4. Integrate: Validate tokens in MCP request handlers.

Benefits: Delegates auth, supports federation.

Code integration: Use middleware to introspect tokens before executing tools.
```python
async def auth_middleware(request):
    token = request.headers.get('Authorization')
    # Introspect with Ory: ory introspect token $token
    if not valid:
        raise Exception("Unauthorized")
```
Run locally or on Docker for production.<grok:render card_id="d032c7" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">86</argument></grok:render>

## 7. Ensuring Universality and Claude.ai Compatibility

- **Universality**: Follow MCP spec strictly; expose tools via JSON schemas. Test with local LLMs (e.g., Llama via Ollama).<grok:render card_id="65dd0c" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">3</argument></grok:render>
- **Claude.ai Connection**: Use remote MCP URL in Claude settings (Pro/Max: Add custom integration; Enterprise: Organization integrations). Authenticate via OAuth flow; enable tools in chat menu.<grok:render card_id="d17cb2" card_type="citation_card" type="render_inline_citation"><argument name="citation_id">84</argument></grok:render> Test: "Use MCP to fetch GitHub repo."

Security: Review permissions, monitor requests, use trusted servers only.

## 8. Best Practices and Error Prevention

- Handle async/streaming errors with try/except.
- Use semantic checksums for data integrity.
- Test end-to-end: Local run, Claude connection, OAuth flows.
- Metrics: Log compression ratios, response times.
- Avoid: Vendor locks, unverified scopes.

This guide ensures a mistake-free build; reference sources for code tweaks.