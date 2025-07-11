⟦compression: 82%→91% | mode: M | segments: 47⟧

[Context block]
@context: MCP=Model Context Protocol
@flows: init→negotiate→operate→shutdown
@prereq: JSON-RPC, LLM, SDK(TS|Py|Java|Kotlin|C#)
@transport: stdio|http-stream|custom

# MCP Compressed Documentation

## ⟦T:⟧Architecture
```
Host[1]→Client[N]→Server[N]→Resource[N]
├─ H: container+coordinator{perms,auth,LLM}
├─ C: 1:1/server{isolated,stateful}
└─ S: capabilities{resources,tools,prompts}→⟦N:⟧"USB-C for AI"

@principles:[
  easy_build>>complex_orchestration,
  composable+isolated,
  !server_sees_full_conv,
  progressive_features
]
```

## ⟦T:⟧Protocol Core
```
@msg: JSON-RPC/2.0{req,res,notif}
├─ req: {id,method,params?}
├─ res: {id,result?|error?}
└─ notif: {method,params?}!id

@lifecycle: init{caps,ver}→operate→shutdown
@caps: {
  C: roots?,sampling?,elicitation?
  S: prompts?,resources?,tools?,logging?,completions?
}
```

## ⟦M:⟧Quickstart Flows

### ⟦T:⟧Server Dev
```
@flow: env_setup→implement{res,tool,prompt}→test→deploy
@sdk: pip+"mcp[cli]"|npm+@mcp/sdk
```

⟦→N⟧Weather server example:⟦T:⟧
```python
mcp = FastMCP("weather")
@mcp.tool()
async def get_forecast(lat:float,lon:float)->str:
  return await nws_api(f"/points/{lat},{lon}")
```

### ⟦T:⟧Client Dev
```
@flow: init_session→list_tools→process_query{
  Claude/API→tool_exec→response
}
```

### ⟦N:⟧User Setup
1. Install Claude Desktop
2. Edit⟦T:⟧`claude_desktop_config.json`:
```json
{"mcpServers":{"name":{"command":"npx","args":["-y","@mcp/server-pkg"]}}}
```

## ⟦T:⟧Core Features

### Resources⟦M:⟧(app-controlled)
```
@uri: scheme://path{file,https,git,custom}
@ops: list[page]→read→subscribe?
@content: text|blob(base64)
```

### Tools⟦M:⟧(model-controlled)
```
@def: {name,desc,inputSchema,outputSchema?}
@exec: call→result{content[]|structuredContent?,isError?}
@content: text|image|audio|resource|resource_link
```

### Prompts⟦M:⟧(user-controlled)
```
@def: {name,title?,desc?,args[]}
@msg: {role,content:{text|image|audio|resource}}
```

## ⟦T:⟧Transports

### stdio
```
proc[stdin→JSON-RPC→stdout,stderr:log]
```

### HTTP-Stream
```
POST→Accept{json|text/event-stream}
├─ single: res(json)
├─ stream: SSE[msg*]→res→close
└─ session?: Mcp-Session-Id→persist
@resume: Last-Event-ID→replay
```

## ⟦T:⟧Security/Auth

### OAuth2.1
```
@flow: 401{WWW-Auth}→discover{RS→AS}→
  ?register→authorize{PKCE,resource}→token
@validate: !passthrough,audience_bind,resource_param
```

### ⟦N:⟧Best Practices
- Human-in-loop for tools/sampling
- Validate inputs/outputs
- Rate limit
- No sensitive data in logs
- Audit trails

## ⟦T:⟧Client Features

### Sampling⟦M:⟧(LLM requests)
```
createMessage{msgs[],model_prefs,context}→
  user_review→LLM→response_review→result
@prefs: {hints[],cost/speed/intel_priority}
```

### Roots⟦M:⟧(filesystem boundaries)
```
list→roots[{uri:file://,name}]
@notif: list_changed
```

### Elicitation⟦M:⟧(user input requests)
```
create{message,requestedSchema}→
  {action:accept|decline|cancel,content?}
@schema: flat_object{string|number|boolean|enum}
```

## ⟦T:⟧Utils

### Completion
```
complete{ref:{prompt|resource},arg,context?}→
  {values[≤100],total?,hasMore?}
```

### Logging
```
setLevel→notif/message{level∈RFC5424,logger?,data}
```

### Progress
```
req{_meta.progressToken}→notif/progress{token,progress,total?,msg?}
```

## ⟦M:⟧Implementation Examples

⟦T:⟧Python:
```python
async with stdio_server() as streams:
  await app.run(streams[0],streams[1],init_opts)
```

⟦T:⟧TypeScript:
```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
```

⟦T:⟧Config:
```json
{
  "mcpServers":{
    "name":{
      "command":"cmd",
      "args":["path"],
      "env":{"KEY":"val"}
    }
  }
}
```

## ⟦N:⟧Common Patterns

1. **Discovery**:⟦T:⟧list_*→use→?subscribe
2. **Tool Flow**:⟦N:⟧user_prompt→⟦T:⟧LLM→select→approve→exec→result
3. **Auth**:⟦N:⟧discover→consent→⟦T:⟧token→validate_audience
4. **Debug**:⟦T:⟧inspector|logs{~/Library/Logs/Claude/*.log}

## ⟦T:⟧Error Codes
```
-32002: ResourceNotFound
-32601: MethodNotFound  
-32602: InvalidParams
-32603: InternalError
401: Unauthorized
403: Forbidden
```

⟦legend:
  MCP: Model Context Protocol
  H: Host, C: Client, S: Server
  AS: Authorization Server, RS: Resource Server
  SSE: Server-Sent Events
  PKCE: Proof Key for Code Exchange
⟧