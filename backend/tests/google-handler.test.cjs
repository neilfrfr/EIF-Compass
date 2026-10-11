const assert=require('node:assert/strict');const {createGoogleHandler}=require('../google/handler.cjs');const {encrypt,decrypt}=require('../google/crypto.cjs');
const u='11111111-1111-4111-8111-111111111111',cohort='22222222-2222-4222-8222-222222222222',source='33333333-3333-4333-8333-333333333333';
const env={APP_URL:'https://compass.test',GOOGLE_REDIRECT_URI:'https://compass.test/api/google/callback',GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret',GOOGLE_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),SUPABASE_URL:'https://db.test',SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SECRET_KEY:'sb_secret_test'};
const calls=[],states=new Map(),events=new Map(),mappings=new Map();let connection=null,denyRefresh=false;
const json=(v,status=200)=>new Response(JSON.stringify(v),{status});
const fetchImpl=async(url,options={})=>{
 calls.push({url,options});const body=options.body?JSON.parse(options.body):null;
 if(url.endsWith('/auth/v1/user'))return json({id:u});
 if(url.includes('/profiles?'))return json([{role:'intern',cohort_id:cohort}]);
 if(url.includes('/requirements?'))return json([{id:source,title:'Reflection',due_date:'2099-01-01',cohort_id:cohort}]);
 if(url.includes('/events?'))return json([]);
 if(url.includes('/rpc/eif_google_store')){
  assert.equal(options.headers.Authorization,undefined,'Opaque secret goes only in apikey header');
  const {op,owner,args}=body;
  if(op==='state_put')states.set(args.hash,{user_id:owner,binding_hash:args.binding,verifier:args.verifier});
  if(op==='state_consume'){const value=states.get(args.hash);if(value?.binding_hash===args.binding){states.delete(args.hash);return json(value)}return json(null)}
  if(op==='connect_get')return json(connection);
  if(op==='connect_put')connection={email:args.email,tokens:args.tokens};
  if(op==='connect_refresh'){if(denyRefresh||connection?.tokens!==args.previous)return json(null);connection.tokens=args.tokens;return json(connection)}
  if(op==='connect_delete')connection=null;
  if(op==='sync_get')return json(mappings.get(args.id)||null);
  if(op==='sync_put')mappings.set(args.id,args);
  return json(null);
 }
 if(url.startsWith('https://www.googleapis.com/')){
  const id=url.split('/').pop();
  if(options.method==='GET')return events.has(id)?json(events.get(id)):json({},404);
  if(options.method==='POST'){if(events.has(body.id))return json({},409);events.set(body.id,body);return json(body,201)}
  if(options.method==='PATCH'){events.set(id,{...events.get(id),...body});return json(events.get(id))}
 }
 throw new Error('unexpected URL');
};
let oauthTokens={scope:'openid email https://www.googleapis.com/auth/calendar.events',id_token:'idtoken',refresh_token:'refresh',access_token:'access'};
const oauthFactory=()=>({credentials:{},async generateCodeVerifierAsync(){return {codeVerifier:'verifier',codeChallenge:'challenge'}},generateAuthUrl(options){return 'https://google.test/?state='+options.state},async getToken(){return {tokens:oauthTokens}},async verifyIdToken(){return {getPayload(){return {email:'intern@test',email_verified:true}}}},setCredentials(tokens){this.credentials=tokens},async getAccessToken(){return {token:'access'}},async revokeToken(){}});
const handler=createGoogleHandler({env,fetchImpl,oauthFactory});
async function request(action,extra={},instance=handler){const req={query:{action},method:action==='status'||action==='callback'?'GET':action==='connection'?'DELETE':'POST',headers:{origin:env.APP_URL,authorization:'Bearer user'},body:{},...extra};const res={headers:{},setHeader(k,v){this.headers[k]=v},status(v){this.code=v;return this},json(v){this.body=v},redirect(code,url){this.code=code;this.location=url}};await instance(req,res);return res}
const sync=()=>request('sync',{body:{sources:[{type:'requirement',id:source}] }},createGoogleHandler({env,fetchImpl,oauthFactory}));
(async()=>{
 assert.equal((await request('sync',{headers:{origin:env.APP_URL}})).code,401);
 assert.equal((await request('sync',{headers:{origin:'https://evil.test',authorization:'Bearer user'}})).code,403);
 assert.equal((await request('callback',{query:{action:'callback',state:'forged',code:'code'},headers:{}})).code,400);assert.equal(states.size,0);
 assert.equal((await request('sync',{body:{sources:[{type:'event',id:'not-a-uuid'}]}})).code,400);
 const connected=await request('connect');assert.equal(connected.code,200);
 const state=new URL(connected.body.url).searchParams.get('state');const cookie=connected.headers['Set-Cookie'].split(';')[0];
 assert.equal((await request('callback',{query:{action:'callback',state,code:'code'},headers:{cookie:'eif_google_binding=wrong'}})).code,400);assert.equal(states.size,1,'Wrong browser must not consume state');
 const callback=await request('callback',{query:{action:'callback',state,code:'code'},headers:{cookie}});assert.equal(callback.code,303);assert.match(callback.location,/connected/);assert.ok(connection.tokens&&!connection.tokens.includes('refresh'));assert.equal(JSON.parse(decrypt(connection.tokens,env.GOOGLE_TOKEN_ENCRYPTION_KEY)).refresh_token,'refresh');
 assert.equal((await request('callback',{query:{action:'callback',state,code:'code'},headers:{cookie}})).code,400,'State replay rejected');
 let result=await sync();assert.equal(result.body.results[0].status,'created');assert.equal(events.size,1);result=await sync();assert.equal(result.body.results[0].status,'skipped');assert.equal(events.size,1,'Repeated sync creates no duplicate');
 const oldId=mappings.get(source).event_id;events.set(oldId,{status:'cancelled'});result=await sync();assert.equal(result.body.results[0].status,'created');assert.notEqual(mappings.get(source).event_id,oldId);result=await sync();assert.equal(result.body.results[0].status,'skipped','Restored event remains retry safe');
 result=await request('sync',{body:{sources:[{type:'event',id:source},{type:'requirement',id:source}]}},createGoogleHandler({env,fetchImpl,oauthFactory}));assert.deepEqual(result.body.results.map(r=>r.status),['failed','skipped'],'One unavailable record does not abort batch');
 denyRefresh=true;assert.equal((await sync()).code,409,'Disconnected or replaced credential cannot be resurrected');denyRefresh=false;
 const disconnected=await request('connection');assert.equal(disconnected.code,200);assert.equal(connection,null);assert.equal(events.size,2,'Disconnect retains calendar entries');
 assert.ok(!calls.some(c=>c.url.includes('/auth/v1/user')&&c.options.headers.apikey!==env.SUPABASE_PUBLISHABLE_KEY));
 console.log('PASS: auth, origin, PKCE binding, atomic replay, encrypted credentials, opaque keys, repeat/restore idempotency, partial failure and connection changes');
})().catch(e=>{console.error(e);process.exitCode=1});
