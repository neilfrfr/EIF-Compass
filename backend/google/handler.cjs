const crypto=require('node:crypto');
const {OAuth2Client}=require('google-auth-library');
const {encrypt,decrypt,keyBytes}=require('./crypto.cjs');
const {stableEventId,eventPayload}=require('./calendar.cjs');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function createGoogleHandler({env=process.env,fetchImpl=fetch,oauthFactory=()=>new OAuth2Client({clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET,redirectUri:env.GOOGLE_REDIRECT_URI,transporterOptions:{timeout:10000}})}={}){
 const active=new Set(),limits=new Map();
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const fail=(status,error)=>res.status(status).json({error});
  const action=req.query?.action||req.url?.split('?')[0].split('/').pop();
  const methods={connect:'POST',callback:'GET',status:'GET',sync:'POST',connection:'DELETE'};
  if(!methods[action])return fail(404,'Unknown Google action.');
  if(req.method!==methods[action]){res.setHeader('Allow',methods[action]);return fail(405,'Method not allowed.');}
  let userId,acquired=false;
  try{
   const origin=new URL(env.APP_URL||'').origin;
   if(origin!==env.APP_URL||env.GOOGLE_REDIRECT_URI!==`${origin}/api/google/callback`)return fail(503,'Google Calendar needs a valid server app URL and callback.');
   if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.SUPABASE_URL||!(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY))return fail(503,'Google Calendar is not configured yet.');
   keyBytes(env.GOOGLE_TOKEN_ENCRYPTION_KEY);
   const db=env.SUPABASE_URL.replace(/\/$/,''),privileged=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
   const store=async(op,owner,args={})=>{
    const response=await fetchImpl(`${db}/rest/v1/rpc/eif_google_store`,{method:'POST',headers:{apikey:privileged,...(!privileged.startsWith('sb_secret_')?{Authorization:`Bearer ${privileged}`}:{}),'Content-Type':'application/json'},body:JSON.stringify({op,owner,args}),signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('Google connection storage is unavailable. Check the migration.');return response.json();
   };
   const oauth=oauthFactory();
   if(action==='callback'){
    const q=req.query||Object.fromEntries(new URL(req.url,origin).searchParams);
    const cookie=/\beif_google_binding=([A-Za-z0-9_-]+)/.exec(req.headers.cookie||'')?.[1];
    if(typeof q.state!=='string'||!cookie||q.state.length>200)return fail(400,'Google connection expired. Start Connect again.');
    const state=await store('state_consume',null,{hash:hash(q.state),binding:hash(cookie)});
    res.setHeader('Set-Cookie','eif_google_binding=; Path=/api/google/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    if(!state)return fail(400,'Invalid or already-used Google connection. Start Connect again.');
    if(q.error)return res.redirect(303,`${origin}/?google=denied`);
    if(typeof q.code!=='string'||q.code.length>4096)return fail(400,'Google did not return an authorization code.');
    const {tokens}=await oauth.getToken({code:q.code,codeVerifier:state.verifier});
    if(!tokens.scope?.split(' ').includes('https://www.googleapis.com/auth/calendar.events')||!tokens.id_token)return fail(403,'Calendar access was not granted. Connect again.');
    const ticket=await oauth.verifyIdToken({idToken:tokens.id_token,audience:env.GOOGLE_CLIENT_ID});const identity=ticket.getPayload();
    if(!identity?.email||!identity.email_verified)return fail(403,'Google account email was not verified.');
    const prior=await store('connect_get',state.user_id);
    const previous=prior?JSON.parse(decrypt(prior.tokens,env.GOOGLE_TOKEN_ENCRYPTION_KEY)):null;
    const refresh=tokens.refresh_token||(prior?.email===identity.email?previous?.refresh_token:null);
    if(!refresh)return fail(400,'Google did not grant offline access. Reconnect and grant consent.');
    await store('connect_put',state.user_id,{email:identity.email,tokens:encrypt(JSON.stringify({...tokens,refresh_token:refresh}),env.GOOGLE_TOKEN_ENCRYPTION_KEY)});
    return res.redirect(303,`${origin}/?google=connected`);
   }
   if(req.method!=='GET'&&req.headers.origin!==origin)return fail(403,'Request origin is not allowed.');
   const token=/^Bearer ([^\s]+)$/i.exec(req.headers.authorization||'')?.[1];if(!token)return fail(401,'Sign in to connect Google Calendar.');
   const key=env.SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_PUBLISHABLE_KEY;
   const read=async path=>{const response=await fetchImpl(db+path,{headers:{apikey:key,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});if(!response.ok){const e=new Error('Could not verify your workspace.');e.status=path.startsWith('/auth')?401:502;throw e}return response.json()};
   const user=await read('/auth/v1/user');if(!uuid.test(user?.id||''))return fail(401,'Sign in again.');userId=user.id;
   const profiles=await read(`/rest/v1/profiles?select=role,cohort_id&id=eq.${userId}&limit=1`),profile=profiles[0];if(!profile?.cohort_id||!['intern','lead'].includes(profile.role))return fail(403,'Your account needs a fellowship role and cohort.');
   if(action==='sync'){
    if(typeof req.body==='string')req.body=JSON.parse(req.body);
    if(Buffer.byteLength(JSON.stringify(req.body||{}))>12000)return fail(413,'Request is too large.');
    const sources=req.body?.sources;
    if(!Array.isArray(sources)||!sources.length||sources.length>20||sources.some(s=>!['event','requirement'].includes(s?.type)||!uuid.test(s.id||'')))return fail(400,'Select one to twenty valid events or deadlines.');
   }
   const now=Date.now();for(const [id,item]of limits)if(item.until<=now)limits.delete(id);
   const limit=limits.get(userId)||{until:now+60000,count:0};if(limit.count>=10||active.has(userId))return fail(429,'Please wait a minute before trying again.');limit.count++;limits.set(userId,limit);active.add(userId);acquired=true;
   if(action==='connect'){
    const state=crypto.randomBytes(32).toString('base64url'),binding=crypto.randomBytes(32).toString('base64url');
    const {codeVerifier,codeChallenge}=await oauth.generateCodeVerifierAsync();
    await store('state_put',userId,{hash:hash(state),binding:hash(binding),verifier:codeVerifier});
    res.setHeader('Set-Cookie',`eif_google_binding=${binding}; Path=/api/google/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    return res.status(200).json({url:oauth.generateAuthUrl({access_type:'offline',prompt:'consent',scope:['openid','email','https://www.googleapis.com/auth/calendar.events'],state,code_challenge:codeChallenge,code_challenge_method:'S256'})});
   }
   const connection=await store('connect_get',userId);
   if(action==='status')return res.status(200).json({connected:!!connection,email:connection?.email||null});
   if(!connection)return fail(409,'Connect your Google Calendar first.');
   const tokens=JSON.parse(decrypt(connection.tokens,env.GOOGLE_TOKEN_ENCRYPTION_KEY));oauth.setCredentials(tokens);
   if(action==='connection'){
    // Remove local credentials even if Google's revocation service is unavailable.
    let revoked=true;try{await oauth.revokeToken(tokens.refresh_token)}catch{revoked=false}
    await store('connect_delete',userId);return res.status(200).json({connected:false,revoked,message:revoked?'Disconnected. Existing calendar entries remain.':'Local connection removed. Revoke EIF Compass in your Google account settings too.'});
   }
   let access;try{access=(await oauth.getAccessToken()).token}catch{return fail(409,'Google access expired or was revoked. Reconnect your calendar.');}
   if(!access)return fail(409,'Reconnect your Google Calendar.');
   const renewed={...tokens,...oauth.credentials,refresh_token:tokens.refresh_token};const refreshed=await store('connect_refresh',userId,{previous:connection.tokens,tokens:encrypt(JSON.stringify(renewed),env.GOOGLE_TOKEN_ENCRYPTION_KEY)});if(!refreshed)return fail(409,'Google connection changed. Refresh and reconnect if needed.');
   const results=[];const unique=[...new Map(req.body.sources.map(s=>[`${s.type}:${s.id}`,s])).values()];
   const google=async(path,method='GET',body)=>{const response=await fetchImpl(`https://www.googleapis.com/calendar/v3/calendars/primary/events${path}`,{method,headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});return {status:response.status,data:response.status===204?{}:await response.json()}};
   const started=Date.now();
   for(const source of unique){
    if(Date.now()-started>230000){results.push({...source,status:'failed',error:'Batch time limit reached. Sync remaining entries again.'});continue}
    try{
     const rows=await read(`/rest/v1/${source.type==='event'?'events':'requirements'}?select=*&id=eq.${source.id}&cohort_id=eq.${profile.cohort_id}&limit=1`);
     const record=rows[0];if(!record||(source.type==='requirement'&&profile.role==='intern'&&record.assignee_id&&record.assignee_id!==userId))throw new Error('Record unavailable or not permitted.');
     const payload=eventPayload(source.type,record),fingerprint=hash(JSON.stringify(payload));
     const mapping=await store('sync_get',userId,{type:source.type,id:source.id});let id=mapping?.event_id||stableEventId(userId,source.type,source.id);
     const marker=stableEventId(userId,source.type,source.id);payload.extendedProperties={private:{eifSource:marker}};
     let found=await google(`/${id}`);let result,status;
     if(found.data.status==='cancelled'||found.status===410){id=hash(`${id}:restored`);found=await google(`/${id}`)}
     if(found.status===200&&found.data.status!=='cancelled'){
      if(found.data.extendedProperties?.private?.eifSource!==marker)throw new Error('Calendar entry is not managed by EIF Compass.');
      if(mapping?.fingerprint===fingerprint){if(mapping.event_id!==id)await store('sync_put',userId,{type:source.type,id:source.id,event_id:id,fingerprint});results.push({...source,status:'skipped'});continue}
      result=await google(`/${id}`,'PATCH',payload);status='updated';
     }else if(found.status===404){
      result=await google('','POST',{...payload,id});status='created';
      if(result.status===409){const existing=await google(`/${id}`);if(existing.status===200&&existing.data.extendedProperties?.private?.eifSource===marker){result=await google(`/${id}`,'PATCH',payload);status='updated'}}
     }else if(found.data.status==='cancelled'||found.status===410){throw new Error('This entry was deleted in Google. Contact your lead before restoring it.');}
     else throw new Error(found.status===429?'Google rate limit reached. Retry later.':'Google could not load the calendar entry.');
     if(![200,201].includes(result.status))throw new Error(result.status===429?'Google rate limit reached. Retry later.':result.status===401?'Reconnect your Google Calendar.':'Google could not save this entry.');
     await store('sync_put',userId,{type:source.type,id:source.id,event_id:id,fingerprint});results.push({...source,status});
    }catch(error){results.push({...source,status:'failed',error:error.message||'Sync failed.'})}
   }
   return res.status(200).json({results});
  }catch(error){return fail(error.status||502,'Could not complete Google Calendar request. Check configuration or reconnect and try again.');}
  finally{if(acquired)active.delete(userId)}
 };
}
module.exports={createGoogleHandler};
