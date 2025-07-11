⟦UCIS3.5: 71% | L:3 | modes:T,M | dict:45⟧

⟦dict:⟧
@m=MCP
@s=server
@c=client  
@as=authorization_server
@rs=resource_server
@ps=MCP_proxy_server
@3p=third-party
@api=/api/v2
@auth=Authorization
@tok=access_token
@ref=refresh_token
@req=request
@res=response
@hdr=header
@proto=protocol
@trans=transport
@init=initialize
@sess=session
@oauth=OAuth_2.1
@dyn=dynamic_client_registration
@meta=metadata
@ep=endpoint
@http=HTTP
@sse=Server-Sent_Events
@stdio=standard_input/output
@json=JSON-RPC
$m!=MUST
$s!=SHOULD  
$mn!=MUST_NOT
$sn!=SHOULD_NOT
$my=MAY
%impl=implementation
%spec=specification
%sec=security
%vuln=vulnerability
→=then/leads_to
≡=equals/defined_as
∈=belongs_to
@flow=authorization_flow
@bear=Bearer_{token}
@rfc8={8414:AS_metadata,8707:resource_indicators,9728:protected_resource_metadata,7591:dynamic_registration}
@err={401:Unauthorized,403:Forbidden,400:Bad_Request}
@cap=capabilities
@notif=notification
@stream=Streamable_HTTP
⟦patterns:⟧
@std_flow=@c→@s:@req→@as:@auth→@tok→@c:use(@tok)
@dyn_reg=@c→@as:POST/register→credentials
@consent=user_reviews→approves→cookie_set

⟦content:⟧
# @m Documentation Compressed

## 1. @auth Specification
⟦T:⟧Protocol:2025-06-18

### Purpose
@m→@auth(@trans-level)→@c:@req→restricted_@s(on_behalf_of_owners)
⟦M:⟧%spec defines @flow for @http-based @trans

### Requirements
- @auth≡OPTIONAL for @m %impl
- @http-@trans $s! conform
- @stdio-@trans $sn! follow(retrieve_from_env)
- Alternative @trans $m! follow_best_practices

### Standards (@oauth+subsets)
- @oauth IETF DRAFT
- @rfc8.8414,@rfc8.7591,@rfc8.9728

### Roles
⟦T:⟧@s≡@oauth.@rs(accept+respond:protected_@req+@tok)
@c≡@oauth.@c(make_protected_@req:behalf_of_owner)
@as≡responsible(interact_user+issue_@tok)

### @flow Overview
1. @as $m! %impl @oauth+%sec_measures
2. @as+@c $s! support @rfc8.7591(@dyn)
3. @s $m! %impl @rfc8.9728
4. @as $m! provide @rfc8.8414

### Discovery
⟦T:⟧@s $m! %impl @rfc8.9728→indicate(@as_locations)
@meta_doc $m! include authorization_servers[]≥1

WWW-Authenticate:@hdr $m! indicate(@rs.@meta_URL)→401
@c $m! parse WWW-Authenticate+respond(401)

#### Sequence
@c→@m:@req(!@tok)→401+WWW-Auth
@c:extract→GET/.well-known/oauth-protected-resource
@m→@c:@meta+@as_URL
@c→@as:GET/.well-known/oauth-@as
@as→@c:@as.@meta
[@oauth.@flow]
@c→@as:@tok.@req→@tok
@c→@m:@req+@tok→@res

### @dyn Registration
⟦M:⟧@c+@as $s! support @rfc8.7591→obtain(client_IDs)!user_interaction

Benefits:
- @c !know_all_@s_in_advance
- !manual_registration
- seamless_connection→new_@s
- @as:implement_own_policies

!@dyn→alternatives:{hardcode_ID,present_UI}

### Resource Parameter
⟦T:⟧@c $m! %impl @rfc8.8707(resource_indicators)
resource_param $m!:{
  in:[@auth.@req,@tok.@req]
  identify:target_@m_@s
  use:canonical_URI(@s)
}

Examples_valid:{
  https://mcp.example.com/mcp
  https://mcp.example.com:8443
}
Examples_invalid:{
  mcp.example.com(!scheme)
  https://mcp.example.com#fragment
}

### @tok Usage
⟦T:⟧@tok_handling $m! conform(@oauth.§5)
@c $m! use:@auth @req.@hdr→@bear
!include_in_URI_query

@s $m! validate(@tok)→intended_audience(@rfc8.8707.§2)
fail→@err[status_codes]

### %sec Considerations
⟦M:⟧%impl $m! follow @oauth.§7

#### @tok Audience Binding
@rfc8.8707→critical_%sec:bind(@tok→intended_audiences)
- @c $m! include resource_param
- @s $m! validate(@tok:specifically_issued_for_them)

#### @tok Theft
Attackers+stolen_@tok→access_protected_resources
Mitigations:
- %impl $m! secure_@tok_storage
- @as $s! issue(short-lived_@tok)
- public_@c:@as $m! rotate(@ref)

#### Communication %sec
All @as @ep $m! HTTPS
redirect_URIs $m! {localhost|HTTPS}

#### PKCE Protection
@c $m! %impl PKCE→prevent(code_interception+injection)

## 2. Lifecycle Management
⟦T:⟧@proto:2025-06-18

Phases:{@init,Operation,Shutdown}

### @init Phase
@c $m! initiate→send(@init.@req):{
  protocolVersion,
  @cap.@c,
  clientInfo:{name,title,version}
}

@s→@res:{
  protocolVersion,
  @cap.@s,
  serverInfo,
  instructions?
}

@c→@notif:initialized

Rules:
- @c $sn! send(@req)≠ping before @init.@res
- @s $sn! send(@req)≠{ping,logging} before initialized.@notif

### Version Negotiation
@c:send(latest_supported)
@s:support(requested)→@res(same)
else→@res(latest_@s_supports)
@c:!support(@s_version)→disconnect

⟦M:⟧@http:@c $m! include MCP-Protocol-Version:@hdr

### @cap Negotiation
Key @cap:{
  @c:[roots,sampling,elicitation,experimental]
  @s:[prompts,resources,tools,logging,completions,experimental]
}

Sub-@cap:{listChanged,subscribe(resources_only)}

## 3. @trans Mechanisms
⟦T:⟧@m:@json(UTF-8)

Standard @trans:{@stdio,@stream}
@c $s! support @stdio when_possible

### @stdio Transport
- @c:launch(@s:subprocess)
- @s:read(stdin)→write(stdout)
- Messages:newline-delimited,!embedded_newlines
- @s $my write(stderr:UTF-8_logs)
- @s $mn! write(stdout)≠valid_@m_message

### @stream Transport
⟦T:⟧@s:independent_process→handle(multiple_@c)
Uses:@http(POST+GET)→optional(@sse)

@s $m! provide:single_@http_@ep(POST+GET)

#### %sec Warning
1. @s $m! validate(Origin:@hdr)→prevent(DNS_rebinding)
2. local:bind(127.0.0.1)!0.0.0.0
3. @s $s! %impl proper_@auth

#### Sending→@s
@c→@http.POST:@json.@req/@notif/@res
Accept:@hdr[application/json,text/event-stream]

@res/@notif→@s:202_Accepted(!body)
@req→@s:{text/event-stream|application/json}

@sse_stream:{
  $s! include:@json.@res(for_POST.@req)
  $my send:@req/@notif(before_@res)
  $sn! close(before_@res)≠@sess_expires
}

#### Listening←@s
@c $my:GET→@ep
Accept:text/event-stream
@s:{return(@sse)|405_Method_Not_Allowed}

### @sess Management
⟦T:⟧@s $my assign(@sess_ID)→Mcp-Session-Id:@hdr
@sess_ID:{globally_unique,cryptographically_secure,ASCII[0x21-0x7E]}

@c:receive(Mcp-Session-Id)→$m! include(all_subsequent_@req)
@s $my terminate→404
@c:receive(404)→new_@init(!@sess_ID)

### Protocol Version @hdr
@http:@c $m! include MCP-Protocol-Version:@hdr
!@hdr→@s $s! assume(2025-03-26)
invalid/unsupported→400

## 4. %sec Best Practices

### Confused Deputy Problem
⟦M:⟧@ps+static_client_ID→@3p.@api→%vuln

Attack:{
  user→normal_@auth→@3p.@as:set_cookie(consent)
  attacker→malicious_link→user_click
  @3p.@as:detect_cookie→skip_consent
  @auth_code→attacker→@tok→impersonate
}

Mitigation:@ps $m! obtain_consent(each_@dyn.@c)

### @tok Passthrough
⟦T:⟧Anti-pattern:@s accepts(@tok)!validating→pass_to_downstream

Risks:{
  %sec_control_circumvention
  accountability_issues  
  trust_boundary_violations
  future_compatibility_risk
}

Mitigation:@s $mn! accept(@tok)≠explicitly_issued_for_@s

### @sess Hijacking
Attack_vectors:{
  @sess_hijack_prompt_injection
  @sess_hijack_impersonation
}

Mitigations:{
  @s $m! verify(all_inbound_@req)
  @s $mn! use(@sess:@auth)
  secure_non-deterministic_@sess_IDs
  bind(@sess_ID→user_info)
}

## 5. Overview
⟦T:⟧@proto:2025-06-18

Components:{
  Base:core_@json_messages
  Lifecycle:connection_@init+@cap+@sess
  @auth:@auth_framework(@http)
  @s_features:[resources,prompts,tools]
  @c_features:[sampling,root_dirs]
  Utilities:[logging,arg_completion]
}

All %impl $m! support(base+lifecycle)

### Messages(@json)
Types:{@req,@res,@notif}

@req:{jsonrpc:"2.0",id:string|number,method,params?}
@res:{jsonrpc:"2.0",id,result?|error?}
@notif:{jsonrpc:"2.0",method,params?}

Rules:
- @req.id $mn!:null
- @req.id $mn!:previously_used
- @res:either(result|error)!both
- @notif $mn! include:id

### _meta Property
Reserved:@m→attach_@meta
Key_format:prefix?/name
Prefix:labels.separated + / 
Reserved_prefixes:[modelcontextprotocol,mcp]+label

⟦verify:auth_flow,lifecycle,transports,security,oauth_standards⟧