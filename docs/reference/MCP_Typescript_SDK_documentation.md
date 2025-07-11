⟦compression: 78%→82% | mode: T→M | segments: 12⟧

⟦T:⟧# MCP TypeScript SDK

@deps: Node≥18
@pkg: @modelcontextprotocol/sdk
@badges: [npm-version,MIT-license]

## ToC
Overview→Install→QuickStart→Concepts[Server,Resources,Tools,Prompts,Completions,Sampling]→Running[stdio,HTTP]→Examples→Advanced→Docs

## Install
```npm install @modelcontextprotocol/sdk```

## QuickStart
```ts
@import:{McpServer,ResourceTemplate}←"@mcp/sdk/server/mcp.js"
@import:{StdioServerTransport}←"@mcp/sdk/server/stdio.js"
@import:{z}←"zod"

server=new McpServer({name:"demo",v:"1.0.0"})

// Tool
server.registerTool("add",
  {title:"Addition",desc:"Add 2 nums",inputSchema:{a:z.number(),b:z.number()}},
  async({a,b})→({content:[{type:"text",text:String(a+b)}]})
)

// Resource
server.registerResource(
  "greeting",
  new ResourceTemplate("greeting://{name}",{list:undefined}),
  {title:"Greeting",desc:"Dynamic greeting"},
  async(uri,{name})→({contents:[{uri:uri.href,text:`Hello,${name}!`}]})
)

// Connect
transport=new StdioServerTransport()
await server.connect(transport)
```

## Core Concepts

### Server
```ts
@class:McpServer{name,version}→handles[connection,protocol,routing]
```

### Resources⟦→N⟧(GET-like endpoints)
```ts
// Static
server.registerResource(id,uri,metadata,handler)

// Dynamic+params
@template:"users://{userId}/profile"
@completion:{
  repo:(val,ctx)→ctx?.args?.owner==="org1"?
    ["p1","p2","p3"].filter(r→r.startsWith(val)):
    ["default"].filter(r→r.startsWith(val))
}
```

### Tools⟦→N⟧(POST-like,side-effects)
```ts
// Simple
registerTool(name,{title,desc,inputSchema},handler)

// Returns ResourceLinks
handler→{content:[
  {type:"text",text},
  {type:"resource_link",uri,name,mimeType,desc}
]}
```

### Prompts⟦→N⟧(reusable templates)
```ts
@import:{completable}←"@mcp/sdk/server/completable.js"

registerPrompt(name,{
  title,desc,
  argsSchema:{
    dept:completable(z.string(),v→["eng","sales"].filter(d→d.startsWith(v))),
    name:completable(z.string(),(v,ctx)→{
      dept=ctx?.args?.dept
      return dept==="eng"?["Alice","Bob"]:["David","Eve"]
    })
  }
},handler)
```

### Completions
```ts
// Client usage
await client.complete({
  ref:{type:"ref/prompt",name:"example"},
  argument:{name:"argName",value:"partial"},
  context:{arguments:{prevArg:"value"}}
})
```

### Metadata
⟦N:⟧All entities support⟦T:⟧{title?,annotations?.title?}
@precedence:title→annotations.title→name
@util:getDisplayName(entity)

### Sampling⟦→N⟧(LLM requests from server)
```ts
server.registerTool("summarize",
  {desc:"Summarize via LLM",inputSchema:{text:z.string()}},
  async({text})→{
    response=await mcpServer.server.createMessage({
      messages:[{role:"user",content:{type:"text",text:`Summarize:\n\n${text}`}}],
      maxTokens:500
    })
    return{content:[{type:"text",text:response.content.text}]}
  }
)
```

## Transports

### stdio
```ts
transport=new StdioServerTransport()
await server.connect(transport)
```

### HTTP+Streamable

#### Stateful⟦→N⟧(session management)
```ts
@state:Map<sessionId,transport>

app.post('/mcp',async(req,res)→{
  sessionId=req.headers['mcp-session-id']
  if(sessionId&&transports[sessionId]){
    transport=transports[sessionId]
  }else if(!sessionId&&isInitializeRequest(req.body)){
    transport=new StreamableHTTPServerTransport({
      sessionIdGenerator:()→randomUUID(),
      onsessioninitialized:(id)→transports[id]=transport,
      // Security: enableDnsRebindingProtection:true,allowedHosts:['127.0.0.1']
    })
    transport.onclose=()→delete transports[transport.sessionId]
    server=new McpServer(config)
    await server.connect(transport)
  }else{
    res.status(400).json({error:{code:-32000,message:'Bad Request'}})
    return
  }
  await transport.handleRequest(req,res,req.body)
})

app.get('/mcp',handleSessionRequest) // SSE
app.delete('/mcp',handleSessionRequest) // terminate
```

#### CORS⟦→N⟧for browser clients
```ts
app.use(cors({
  origin:'*', // or ['https://domain.com']
  exposedHeaders:['Mcp-Session-Id'],
  allowedHeaders:['Content-Type','mcp-session-id']
}))
```

#### Stateless
```ts
app.post('/mcp',async(req,res)→{
  // Create new instance per request
  server=getServer()
  transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined})
  res.on('close',()→{transport.close();server.close()})
  await server.connect(transport)
  await transport.handleRequest(req,res,req.body)
})
// GET/DELETE→405
```

### DNS Rebinding⟦→N⟧
Default:disabled. Local servers should enable:
```ts
{enableDnsRebindingProtection:true,allowedHosts:['127.0.0.1']}
```

## Examples

### Echo Server
```ts
server.registerResource("echo",
  new ResourceTemplate("echo://{message}",{list:undefined}),
  {title:"Echo Resource"},
  async(uri,{message})→({contents:[{uri:uri.href,text:`Resource:${message}`}]})
)

server.registerTool("echo",
  {title:"Echo Tool",inputSchema:{message:z.string()}},
  async({message})→({content:[{type:"text",text:`Tool:${message}`}]})
)
```

### SQLite Explorer
```ts
@db:sqlite3.Database("database.db")
@helpers:{all:promisify(db.all),close:promisify(db.close)}

registerResource("schema","schema://main",{title:"DB Schema"},
  async(uri)→{
    tables=await db.all("SELECT sql FROM sqlite_master WHERE type='table'")
    return{contents:[{uri:uri.href,text:tables.map(t→t.sql).join("\n")}]}
  }
)

registerTool("query",{title:"SQL Query",inputSchema:{sql:z.string()}},
  async({sql})→{
    try{
      results=await db.all(sql)
      return{content:[{type:"text",text:JSON.stringify(results,null,2)}]}
    }catch(err){
      return{content:[{type:"text",text:`Error:${err.message}`}],isError:true}
    }
  }
)
```

## Advanced

### Dynamic Servers⟦→N⟧
```ts
putMessageTool=server.tool("putMessage",schema,handler)
putMessageTool.disable() // Hidden initially

upgradeAuthTool=server.tool("upgradeAuth",{permission:z.enum(["write","admin"])},
  async({permission})→{
    {ok,err,previous}=await upgradeAuthAndStoreToken(permission)
    if(!ok)return{content:[{type:"text",text:`Error:${err}`}]}
    
    if(previous==="read")putMessageTool.enable()
    if(permission==="write"){
      upgradeAuthTool.update({paramSchema:{permission:z.enum(["admin"])}})
    }else{
      upgradeAuthTool.remove()
    }
  }
)
```

### Low-Level Server
```ts
@import:{Server}←"@mcp/sdk/server/index.js"

server=new Server({name,version},{capabilities:{prompts:{}}})

server.setRequestHandler(ListPromptsRequestSchema,async()→{
  prompts:[{name,description,arguments:[{name,description,required}]}]
})

server.setRequestHandler(GetPromptRequestSchema,async(req)→{
  if(req.params.name!=="example")throw Error("Unknown")
  return{description,messages:[{role:"user",content:{type:"text",text}}]}
})
```

### Elicitation⟦→N⟧(user input requests)
```ts
// Server
await server.server.elicitInput({
  message:`No tables at ${restaurant} on ${date}. Check alternatives?`,
  requestedSchema:{
    type:"object",
    properties:{
      checkAlternatives:{type:"boolean",title:"Check alternatives"},
      flexibleDates:{type:"string",enum:["next_day","same_week"]}
    },
    required:["checkAlternatives"]
  }
})

// Client
client.setRequestHandler(ElicitRequestSchema,async(req)→{
  userResponse=await getInputFromUser(req.params.message,req.params.requestedSchema)
  return{action:userResponse.action,content:userResponse.data}
})
```

### Client Usage
```ts
@import:{Client}←"@mcp/sdk/client/index.js"
@import:{StdioClientTransport}←"@mcp/sdk/client/stdio.js"

transport=new StdioClientTransport({command:"node",args:["server.js"]})
client=new Client({name:"example-client",version:"1.0.0"})
await client.connect(transport)

// Operations
prompts=await client.listPrompts()
prompt=await client.getPrompt({name,arguments:{arg1:"value"}})
resources=await client.listResources()
resource=await client.readResource({uri:"file:///example.txt"})
result=await client.callTool({name,arguments:{arg1:"value"}})
```

### OAuth Proxy
```ts
proxyProvider=new ProxyOAuthServerProvider({
  endpoints:{
    authorizationUrl:"https://auth.external.com/oauth2/v1/authorize",
    tokenUrl:"https://auth.external.com/oauth2/v1/token",
    revocationUrl:"https://auth.external.com/oauth2/v1/revoke"
  },
  verifyAccessToken:async(token)→({token,clientId:"123",scopes:["openid"]}),
  getClient:async(client_id)→({client_id,redirect_uris:["http://localhost:3000/callback"]})
})

app.use(mcpAuthRouter({
  provider:proxyProvider,
  issuerUrl:new URL("http://auth.external.com"),
  baseUrl:new URL("http://mcp.example.com")
}))
```

### Backwards Compatibility⟦→N⟧

#### Client
```ts
try{
  transport=new StreamableHTTPClientTransport(baseUrl)
  await client.connect(transport)
}catch(error){
  // Fallback to SSE
  sseTransport=new SSEClientTransport(baseUrl)
  await client.connect(sseTransport)
}
```

#### Server
```ts
// Modern endpoint
app.all('/mcp',streamableHandler)

// Legacy SSE
app.get('/sse',async(req,res)→{
  transport=new SSEServerTransport('/messages',res)
  await server.connect(transport)
})
app.post('/messages',legacyMessageHandler)
```

## Links
- [MCP Docs](https://modelcontextprotocol.io)
- [Spec](https://spec.modelcontextprotocol.io)
- [Examples](https://github.com/modelcontextprotocol/servers)
- [GitHub](https://github.com/modelcontextprotocol/typescript-sdk)

⟦legend:
@: reference/definition
→: then/returns/maps-to
←: from/import-from
{}: object/config
[]: array/options
?: optional
!: required/important
≥: min-version
⟧