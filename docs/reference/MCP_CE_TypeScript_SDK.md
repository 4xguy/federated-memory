⟦UCIS3.5: 72% | L:3 | modes:T,N,M | dict:47⟧

⟦dict:⟧
@mcp=Model Context Protocol
@sdk=@modelcontextprotocol/sdk
@srv=server
@cli=client
@t=transport
@stdio=StdioServerTransport
@http=StreamableHTTPServerTransport
@res=resource
@tool=tool
@prompt=prompt
@reg=register
@imp=import
@exp=export
@ts=typescript
@ex=example
@cfg=configuration
@req=request
@resp=response
@sess=session
@auth=authorization
@z=zod
$str=z.string()
$num=z.number()
$obj=z.object
@mcps=McpServer
@uri=uri
@cont=content
@txt={type:"text",text:
@param=parameter
@desc=description
@title=title
@input=inputSchema
@msg=message
@conn=connect
@hdl=handler
@ret=return
@asy=async
@aw=await
@fn=function
@err=error
@app=express()
@post=app.post
@get=app.get
@json=express.json()

⟦content:⟧
⟦T:⟧# @mcp TypeScript SDK ![NPM](npm-v/@sdk)![MIT](npm-l/@sdk)

## TOC
[Overview|Installation|Quickstart|What-is-@mcp|Core-Concepts|Running|Examples|Advanced|Docs|Contributing|License]

## Overview
⟦→N⟧@mcp allows apps provide context for LLMs standardized way,separating concerns.⟦T:⟧@ts-SDK implements full spec:
- Build @cli→any @srv
- Create @srv exposing @res,@prompt,@tool
- Use @t:@stdio,@http
- Handle protocol @msg+lifecycle

## Installation
```npm i @sdk```
⚠️Node≥v18

## Quick Start
⟦→M⟧Create simple @srv with calculator @tool+data:

⟦T:⟧```ts
@imp{@mcps,ResourceTemplate}from"@sdk/@srv/mcp.js"
@imp{@stdio}from"@sdk/@srv/stdio.js"
@imp{@z}from"zod"

const @srv=new @mcps({name:"demo-@srv",version:"1.0.0"})

@srv.@reg Tool("add",
  {@title:"Addition Tool",@desc:"Add two numbers",@input:{a:$num,b:$num}},
  @asy({a,b})=>({@cont:[@txt String(a+b)}]})
)

@srv.@reg Resource(
  "greeting",
  new ResourceTemplate("greeting://{name}",{list:undefined}),
  {@title:"Greeting Resource",@desc:"Dynamic greeting generator"},
  @asy(@uri,{name})=>({contents:[{@uri:@uri.href,text:`Hello,${name}!`}]})
)

const @t=new @stdio()
@aw @srv.@conn(@t)
```

## What is @mcp?
⟦→N⟧[@mcp](https://modelcontextprotocol.io) lets build @srv exposing data/functionality to LLMs secure,standardized.Like web API for LLM interactions.⟦T:⟧@srv can:
- Expose data:Resources(GET-like,load info)
- Provide functionality:Tools(POST-like,execute/side-effects)
- Define patterns:Prompts(reusable templates)

## Core Concepts

### Server
⟦T:⟧@mcps=core interface.Handles @conn,protocol,@msg routing:
```const @srv=new @mcps({name:"my-app",version:"1.0.0"})```

### Resources
⟦→M⟧Expose data to LLMs.Like GET endpoints-provide data,no computation/side-effects:

⟦T:⟧```ts
// Static
@srv.@reg Resource("config","config://app",
  {@title:"App Config",@desc:"App @cfg data",mimeType:"text/plain"},
  @asy(@uri)=>({contents:[{@uri:@uri.href,text:"App @cfg here"}]})
)

// Dynamic with @param
@srv.@reg Resource("user-profile",
  new ResourceTemplate("users://{userId}/profile",{list:undefined}),
  {@title:"User Profile",@desc:"User profile info"},
  @asy(@uri,{userId})=>({contents:[{@uri:@uri.href,text:`Profile:user ${userId}`}]})
)

// Context-aware completion
@srv.@reg Resource("repository",
  new ResourceTemplate("github://repos/{owner}/{repo}",{
    list:undefined,
    complete:{repo:(value,context)=>{
      if(context?.arguments?.["owner"]==="org1"){
        @ret["project1","project2","project3"].filter(r=>r.startsWith(value))
      }
      @ret["default-repo"].filter(r=>r.startsWith(value))
    }}
  }),
  {@title:"GitHub Repository",@desc:"Repository info"},
  @asy(@uri,{owner,repo})=>({contents:[{@uri:@uri.href,text:`Repository:${owner}/${repo}`}]})
)
```

### Tools
⟦→M⟧Let LLMs take actions.Expected perform computation+side-effects:

⟦T:⟧```ts
// Simple with @param
@srv.@reg Tool("calculate-bmi",
  {@title:"BMI Calculator",@desc:"Calculate Body Mass Index",
   @input:{weightKg:$num,heightM:$num}},
  @asy({weightKg,heightM})=>({@cont:[@txt String(weightKg/(heightM*heightM))}]})
)

// Async external API
@srv.@reg Tool("fetch-weather",
  {@title:"Weather Fetcher",@desc:"Get weather for city",@input:{city:$str}},
  @asy({city})=>{
    const @resp=@aw fetch(`https://api.weather.com/${city}`)
    const data=@aw @resp.text()
    @ret{@cont:[@txt data}]}
  }
)

// ResourceLinks
@srv.@reg Tool("list-files",
  {@title:"List Files",@desc:"List project files",@input:{pattern:$str}},
  @asy({pattern})=>({@cont:[
    @txt`Found files:"${pattern}":`},
    {type:"resource_link",@uri:"file:///project/README.md",name:"README.md",
     mimeType:"text/markdown",@desc:'A README file'},
    {type:"resource_link",@uri:"file:///project/src/index.ts",name:"index.ts",
     mimeType:"text/@ts",@desc:'An index file'}
  ]})
)
```

#### ResourceLinks
⟦→N⟧Tools @ret ResourceLink objects reference @res without embedding content.Essential for performance with large files.⟦→T⟧

### Prompts
⟦→M⟧Reusable templates help LLMs interact effectively:

⟦T:⟧```ts
@imp{completable}from"@sdk/@srv/completable.js"

@srv.@reg Prompt("review-code",
  {@title:"Code Review",@desc:"Review code best practices",argsSchema:{code:$str}},
  ({code})=>({messages:[{role:"user",@cont:{type:"text",text:`Review code:\n\n${code}`}}]})
)

// Context-aware completion
@srv.@reg Prompt("team-greeting",
  {@title:"Team Greeting",@desc:"Generate greeting team members",
   argsSchema:{
     department:completable($str,(value)=>
       ["engineering","sales","marketing","support"].filter(d=>d.startsWith(value))),
     name:completable($str,(value,context)=>{
       const dept=context?.arguments?.["department"]
       if(dept==="engineering")@ret["Alice","Bob","Charlie"].filter(n=>n.startsWith(value))
       else if(dept==="sales")@ret["David","Eve","Frank"].filter(n=>n.startsWith(value))
       else if(dept==="marketing")@ret["Grace","Henry","Iris"].filter(n=>n.startsWith(value))
       @ret["Guest"].filter(n=>n.startsWith(value))
     })
   }},
  ({department,name})=>({messages:[{role:"assistant",
    @cont:{type:"text",text:`Hello ${name},welcome ${department} team!`}}]})
)
```

### Completions
⟦→N⟧Support argument completions help users fill @prompt args+@res template @param.⟦→T⟧

#### Client Usage
```ts
const result=@aw @cli.complete({
  ref:{type:"ref/@prompt",name:"@ex"},
  argument:{name:"argumentName",value:"partial"},
  context:{arguments:{previousArg:"value"}}
})
```

### Display Names+Metadata
⟦→N⟧All @res,@tool,@prompt support @title for UI.@title=display name,name=unique ID.

⟦T:⟧`@reg*` methods recommended.Older methods(`@tool`,`@prompt`,`@res`)remain for compatibility.

#### Title Precedence Tools
Two ways specify @title:
- `@title` field in @tool @cfg
- `annotations.@title` field(older API)

Precedence:@title→annotations.@title→name

```ts
// Using @reg Tool(recommended)
@srv.@reg Tool("my_@tool",{
  @title:"My Tool",              // Takes precedence
  annotations:{@title:"Annotation Title"}// Ignored if @title set
},@hdl)

// Using @tool annotations(older)
@srv.@tool("my_@tool","@desc",{
  @title:"Annotation Title"      // Used as @title
},@hdl)
```

Client utility:
```ts
@imp{getDisplayName}from"@sdk/shared/metadataUtils.js"
const displayName=getDisplayName(@tool)// Handles precedence
```

### Sampling
⟦→N⟧@srv can @req LLM completions from @conn @cli supporting sampling.

⟦T:⟧```ts
@srv.@reg Tool("summarize",
  {@desc:"Summarize text using LLM",@input:{text:$str.describe("Text summarize")}},
  @asy({text})=>{
    const @resp=@aw @srv.@srv.createMessage({
      messages:[{role:"user",@cont:{type:"text",
        text:`Summarize concisely:\n\n${text}`}}],
      maxTokens:500
    })
    @ret{@cont:[@txt @resp.@cont.type==="text"?@resp.@cont.text:"Unable generate"}]}
  }
)
```

## Running Your Server

### stdio
⟦→M⟧Command-line tools+direct integrations:

⟦T:⟧```ts
@imp{@mcps}from"@sdk/@srv/mcp.js"
@imp{@stdio}from"@sdk/@srv/stdio.js"

const @srv=new @mcps({name:"@ex-@srv",version:"1.0.0"})
// setup @res,@tool,@prompt
const @t=new @stdio()
@aw @srv.@conn(@t)
```

### Streamable HTTP
⟦→M⟧Remote @srv,handles @cli @req+@srv→@cli notifications.

#### With Session Management
⟦→N⟧Stateful @srv via [@sess management](spec.modelcontextprotocol.io).

⟦T:⟧```ts
@imp express from"express"
@imp{randomUUID}from"node:crypto"
@imp{@mcps}from"@sdk/@srv/mcp.js"
@imp{@http}from"@sdk/@srv/streamableHttp.js"
@imp{isInitializeRequest}from"@sdk/types.js"

const @app
@app.use(@json)

const transports:{[@sess Id:string]:@http}={}

@post('/mcp',@asy(@req,res)=>{
  const @sess Id=@req.headers['mcp-@sess-id']as string|undefined
  let @t:@http

  if(@sess Id&&transports[@sess Id]){
    @t=transports[@sess Id]
  }else if(!@sess Id&&isInitializeRequest(@req.body)){
    @t=new @http({
      @sess IdGenerator:()=>randomUUID(),
      on@sess initialized:(@sess Id)=>{transports[@sess Id]=@t},
      // enableDnsRebindingProtection:true,
      // allowedHosts:['127.0.0.1'],
    })
    @t.onclose=()=>{if(@t.@sess Id)delete transports[@t.@sess Id]}
    const @srv=new @mcps({name:"@ex-@srv",version:"1.0.0"})
    // setup @srv
    @aw @srv.@conn(@t)
  }else{
    res.status(400).@json({jsonrpc:'2.0',@err:{code:-32000,@msg:'Bad Request:No valid @sess ID'},id:null})
    @ret
  }
  @aw @t.handleRequest(@req,res,@req.body)
})

const handle@sess Request=@asy(@req:express.Request,res:express.Response)=>{
  const @sess Id=@req.headers['mcp-@sess-id']as string|undefined
  if(!@sess Id||!transports[@sess Id]){
    res.status(400).send('Invalid/missing @sess ID')
    @ret
  }
  const @t=transports[@sess Id]
  @aw @t.handleRequest(@req,res)
}

@get('/mcp',handle@sess Request)
@app.delete('/mcp',handle@sess Request)
@app.listen(3000)
```

>[!TIP]CORS:allow header `mcp-@sess-id`

#### CORS Browser-Based
⟦→N⟧Browser @mcp @cli need CORS.`Mcp-@sess-Id` header must exposed:

⟦T:⟧```ts
@imp cors from'cors'
@app.use(cors({
  origin:'*',// Configure production:['https://domain.com']
  exposedHeaders:['Mcp-@sess-Id'],
  allowedHeaders:['Content-Type','mcp-@sess-id']
}))
```

#### Without Session(Stateless)
⟦→M⟧Simple cases no @sess needed:

⟦T:⟧```ts
@post('/mcp',@asy(@req:Request,res:Response)=>{
  try{
    const @srv=getServer()
    const @t:@http=new @http({@sess IdGenerator:undefined})
    res.on('close',()=>{console.log('@req closed');@t.close();@srv.close()})
    @aw @srv.@conn(@t)
    @aw @t.handleRequest(@req,res,@req.body)
  }catch(@err){
    console.@err('@err handling @mcp @req:',@err)
    if(!res.headersSent){
      res.status(500).@json({jsonrpc:'2.0',@err:{code:-32603,@msg:'Internal @srv @err'},id:null})
    }
  }
})

@get('/mcp',@asy(@req:Request,res:Response)=>{
  console.log('Received GET @mcp @req')
  res.writeHead(405).end(JSON.stringify({
    jsonrpc:"2.0",@err:{code:-32000,@msg:"Method not allowed."},id:null
  }))
})

@app.delete('/mcp',@asy(@req:Request,res:Response)=>{
  console.log('Received DELETE @mcp @req')
  res.writeHead(405).end(JSON.stringify({
    jsonrpc:"2.0",@err:{code:-32000,@msg:"Method not allowed."},id:null
  }))
})

const PORT=3000
setupServer().then(()=>{
  @app.listen(PORT,(@err)=>{
    if(@err){console.@err('Failed start @srv:',@err);process.exit(1)}
    console.log(`@mcp Stateless @http Server listening port ${PORT}`)
  })
}).catch(@err=>{console.@err('Failed setup @srv:',@err);process.exit(1)})
```

⟦→N⟧Useful for:Simple API wrappers,RESTful scenarios,Horizontal scale without shared state

#### DNS Rebinding Protection
⟦→M⟧@http @t includes DNS rebinding protection.Default:**disabled** for compatibility.

**Important**:Local @srv enable protection:

⟦T:⟧```ts
const @t=new @http({
  @sess IdGenerator:()=>randomUUID(),
  enableDnsRebindingProtection:true,
  allowedHosts:['127.0.0.1',...],
  allowedOrigins:['https://yourdomain.com','https://www.yourdomain.com']
})
```

### Testing+Debugging
⟦→N⟧Test with [@mcp Inspector](github.com/modelcontextprotocol/inspector).

## Examples

### Echo Server
⟦→M⟧Simple @srv demonstrating @res,@tool,@prompt:

⟦T:⟧```ts
@srv.@reg Resource("echo",
  new ResourceTemplate("echo://{@msg}",{list:undefined}),
  {@title:"Echo Resource",@desc:"Echoes back messages as @res"},
  @asy(@uri,{@msg})=>({contents:[{@uri:@uri.href,text:`Resource echo:${@msg}`}]})
)

@srv.@reg Tool("echo",
  {@title:"Echo Tool",@desc:"Echoes back provided @msg",@input:{@msg:$str}},
  @asy({@msg})=>({@cont:[@txt`Tool echo:${@msg}`}]})
)

@srv.@reg Prompt("echo",
  {@title:"Echo Prompt",@desc:"Creates @prompt process @msg",argsSchema:{@msg:$str}},
  ({@msg})=>({messages:[{role:"user",@cont:{type:"text",text:`Process @msg:${@msg}`}}]})
)
```

### SQLite Explorer
⟦→M⟧Complex @ex database integration:

⟦T:⟧```ts
@imp sqlite3 from"sqlite3"
@imp{promisify}from"util"

const getDb=()=>{
  const db=new sqlite3.Database("database.db")
  @ret{
    all:promisify<string,any[]>(db.all.bind(db)),
    close:promisify(db.close.bind(db))
  }
}

@srv.@reg Resource("schema","schema://main",
  {@title:"Database Schema",@desc:"SQLite database schema",mimeType:"text/plain"},
  @asy(@uri)=>{
    const db=getDb()
    try{
      const tables=@aw db.all("SELECT sql FROM sqlite_master WHERE type='table'")
      @ret{contents:[{@uri:@uri.href,text:tables.map((t:{sql:string})=>t.sql).join("\n")}]}
    }finally{@aw db.close()}
  }
)

@srv.@reg Tool("query",
  {@title:"SQL Query",@desc:"Execute SQL queries database",@input:{sql:$str}},
  @asy({sql})=>{
    const db=getDb()
    try{
      const results=@aw db.all(sql)
      @ret{@cont:[@txt JSON.stringify(results,null,2)}]}
    }catch(@err:unknown){
      const @err=@err as Error
      @ret{@cont:[@txt`Error:${@err.@msg}`}],isError:true}
    }finally{@aw db.close()}
  }
)
```

## Advanced Usage

### Dynamic Servers
⟦→M⟧Add @tool/@prompt/@res after @conn.Auto emit `listChanged`:

⟦T:⟧```ts
const list@msg Tool=@srv.@tool("list@msg s",{channel:$str},
  @asy({channel})=>({@cont:[@txt @aw list@msg s(channel)}]})
)

const put@msg Tool=@srv.@tool("put@msg",{channel:$str,@msg:$str},
  @asy({channel,@msg})=>({@cont:[@txt @aw put@msg(channel,string)}]})
)
put@msg Tool.disable()// Until upgrade @auth

const upgrade@auth Tool=@srv.@tool("upgrade@auth",{permission:z.enum(["write","admin"])},
  @asy({permission})=>{
    const{ok,@err,previous}=@aw upgrade@auth AndStoreToken(permission)
    if(!ok)@ret{@cont:[@txt`Error:${@err}`}]}
    
    if(previous==="read"){put@msg Tool.enable()}
    
    if(permission==='write'){
      upgrade@auth Tool.update({paramSchema:{permission:z.enum(["admin"])}})
    }else{
      upgrade@auth Tool.remove()
    }
  }
)

const @t=new @stdio()
@aw @srv.@conn(@t)
```

### Low-Level Server
⟦→M⟧More control,use low-level Server directly:

⟦T:⟧```ts
@imp{Server}from"@sdk/@srv/index.js"
@imp{List@prompt s@req Schema,Get@prompt @req Schema}from"@sdk/types.js"

const @srv=new Server(
  {name:"@ex-@srv",version:"1.0.0"},
  {capabilities:{@prompt s:{}}}
)

@srv.set@req Handler(List@prompt s@req Schema,@asy()=>{
  @ret{@prompt s:[{name:"@ex-@prompt",@desc:"An @ex @prompt template",
    arguments:[{name:"arg1",@desc:"@ex argument",required:true}]}]}
})

@srv.set@req Handler(Get@prompt @req Schema,@asy(@req)=>{
  if(@req.@param.name!=="@ex-@prompt"){throw new Error("Unknown @prompt")}
  @ret{@desc:"@ex @prompt",messages:[{role:"user",@cont:{type:"text",text:"@ex @prompt text"}}]}
})

const @t=new @stdio()
@aw @srv.@conn(@t)
```

### Eliciting User Input
⟦→M⟧@srv @req additional info from users:

⟦T:⟧```ts
// Server:Restaurant booking @tool asks alternatives
@srv.@tool("book-restaurant",
  {restaurant:$str,date:$str,partySize:$num},
  @asy({restaurant,date,partySize})=>{
    const available=@aw checkAvailability(restaurant,date,partySize)
    
    if(!available){
      const result=@aw @srv.@srv.elicitInput({
        @msg:`No tables ${restaurant} on ${date}.Check alternatives?`,
        @req edSchema:{
          type:"object",
          properties:{
            checkAlternatives:{type:"boolean",@title:"Check alternative dates",
              @desc:"Would you like check other dates?"},
            flexibleDates:{type:"string",@title:"Date flexibility",
              @desc:"How flexible dates?",
              enum:["next_day","same_week","next_week"],
              enumNames:["Next day","Same week","Next week"]}
          },
          required:["checkAlternatives"]
        }
      })

      if(result.action==="accept"&&result.@cont?.checkAlternatives){
        const alternatives=@aw findAlternatives(restaurant,date,partySize,
          result.@cont.flexibleDates as string)
        @ret{@cont:[@txt`Found alternatives:${alternatives.join(", ")}`}]}
      }
      
      @ret{@cont:[@txt"No booking.Original date not available."}]}
    }
    
    @aw makeBooking(restaurant,date,partySize)
    @ret{@cont:[@txt`Booked table ${partySize} at ${restaurant} on ${date}`}]}
  }
)

// Client:Handle elicitation
@asy @fn getInputFromUser(@msg:string,schema:any):Promise<{
  action:"accept"|"decline"|"cancel";data?:Record<string,any>
}>{throw new Error("getInputFromUser must implemented your platform")}

@cli.set@req Handler(Elicit@req Schema,@asy(@req)=>{
  const userResponse=@aw getInputFromUser(@req.@param.@msg,@req.@param.@req edSchema)
  @ret{action:userResponse.action,@cont:userResponse.action==="accept"?userResponse.data:undefined}
})
```

⟦→N⟧**Note**:Elicitation requires @cli support.@cli declare `elicitation` capability.

### Writing @mcp Clients
⟦→M⟧SDK provides high-level @cli interface:

⟦T:⟧```ts
@imp{Client}from"@sdk/@cli/index.js"
@imp{StdioClient@t}from"@sdk/@cli/stdio.js"

const @t=new StdioClient@t({command:"node",args:["@srv.js"]})
const @cli=new Client({name:"@ex-@cli",version:"1.0.0"})
@aw @cli.@conn(@t)

const @prompt s=@aw @cli.list@prompt s()
const @prompt=@aw @cli.get@prompt({name:"@ex-@prompt",arguments:{arg1:"value"}})
const @res s=@aw @cli.list@res s()
const @res=@aw @cli.read@res({@uri:"file:///@ex.txt"})
const result=@aw @cli.call@tool({name:"@ex-@tool",arguments:{arg1:"value"}})
```

### Proxy @auth @req Upstream
⟦→M⟧Proxy OAuth @req external provider:

⟦T:⟧```ts
@imp{ProxyOAuth@srv Provider}from'@sdk/@srv/@auth/providers/proxyProvider.js'
@imp{mcp@auth Router}from'@sdk/@srv/@auth/router.js'

const proxyProvider=new ProxyOAuth@srv Provider({
  endpoints:{
    @auth Url:"https://@auth.external.com/oauth2/v1/authorize",
    tokenUrl:"https://@auth.external.com/oauth2/v1/token",
    revocationUrl:"https://@auth.external.com/oauth2/v1/revoke"
  },
  verifyAccessToken:@asy(token)=>{
    @ret{token,clientId:"123",scopes:["openid","email","profile"]}
  },
  getClient:@asy(client_id)=>{
    @ret{client_id,redirect_uris:["http://localhost:3000/callback"]}
  }
})

@app.use(mcp@auth Router({
  provider:proxyProvider,
  issuerUrl:new URL("http://@auth.external.com"),
  baseUrl:new URL("http://@mcp.@ex.com"),
  serviceDocumentationUrl:new URL("https://docs.@ex.com/")
}))
```

### Backwards Compatibility
⟦→M⟧@cli/@srv with @http maintain compatibility deprecated HTTP+SSE(protocol 2024-11-05):

#### Client-Side
⟦T:⟧```ts
@imp{Client}from"@sdk/@cli/index.js"
@imp{@http Client@t}from"@sdk/@cli/streamableHttp.js"
@imp{SSEClient@t}from"@sdk/@cli/sse.js"

let @cli:Client|undefined=undefined
const baseUrl=new URL(url)
try{
  @cli=new Client({name:'streamable-http-@cli',version:'1.0.0'})
  const @t=new @http Client@t(new URL(baseUrl))
  @aw @cli.@conn(@t)
  console.log("Connected @http")
}catch(@err){
  console.log("@http failed,fallback SSE")
  @cli=new Client({name:'sse-@cli',version:'1.0.0'})
  const sse@t=new SSEClient@t(baseUrl)
  @aw @cli.@conn(sse@t)
  console.log("Connected SSE")
}
```

#### Server-Side
⟦T:⟧```ts
const transports={streamable:{} as Record<string,@http>,
  sse:{} as Record<string,SSE@srv @t>}

// Modern @http endpoint
@app.all('/@mcp',@asy(@req,res)=>{
  // Handle @http @t modern @cli
})

// Legacy SSE endpoint older @cli
@get('/sse',@asy(@req,res)=>{
  const @t=new SSE@srv @t('/messages',res)
  transports.sse[@t.@sess Id]=@t
  res.on("close",()=>{delete transports.sse[@t.@sess Id]})
  @aw @srv.@conn(@t)
})

@post('/messages',@asy(@req,res)=>{
  const @sess Id=@req.query.@sess Id as string
  const @t=transports.sse[@sess Id]
  if(@t){@aw @t.handlePost@msg(@req,res,@req.body)}
  else{res.status(400).send('No @t found @sess Id')}
})

@app.listen(3000)
```

⟦→N⟧**Note**:SSE deprecated favor @http.New implementations use @http,existing SSE plan migrate.

## Documentation
- [@mcp documentation](modelcontextprotocol.io)
- [@mcp Specification](spec.modelcontextprotocol.io)
- [@ex Servers](github.com/modelcontextprotocol/@srv s)

## Contributing
Issues+PRs welcome GitHub:<github.com/modelcontextprotocol/@ts-sdk>

## License
MIT License—see [LICENSE](LICENSE)

⟦verify:@mcp,@ts,@sdk,@srv,@cli,@t,@res,@tool,@prompt,stdio,http,@sess,@auth,examples⟧