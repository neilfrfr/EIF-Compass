const {loadContext}=require('./context.cjs');
const {systemPrompt}=require('./prompts.cjs');
function createHandler({env=process.env,fetchImpl=fetch,now=()=>new Date()}={}){
 // Per-instance protection. Configure account-level spending limits in OpenRouter;
 // distributed enforcement is a separate deployment concern.
 const windows=new Map(),active=new Set();
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const fail=(status,error)=>res.status(status).json({error});
  if(req.method!=='POST'){res.setHeader('Allow','POST');return fail(405,'Use POST for assistant requests.');}
  const token=/^Bearer ([^\s]+)$/i.exec(req.headers.authorization||'')?.[1];
  if(!token)return fail(401,'Sign in to use the assistant.');
  let body=req.body;
  try{if(typeof body==='string')body=JSON.parse(body);}catch{return fail(400,'Invalid request.');}
  const history=body?.history??[];
  if(!body||typeof body.message!=='string'||!body.message.trim()||body.message.length>2000||!Array.isArray(history)||history.length>6||history.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>1000)||Buffer.byteLength(JSON.stringify(body))>12000)return fail(400,'Enter a message under 2,000 characters with a short conversation history.');
  const url=(env.SUPABASE_URL||env.VITE_SUPABASE_URL||'').replace(/\/$/,'');
  const key=env.SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY;
  if(!url||!key||!env.OPENROUTER_API_KEY||!env.OPENROUTER_MODEL)return fail(503,'The assistant is not configured yet. Ask your lead to configure OpenRouter and Supabase on the server.');
  let userId;
  try{
   const request=async(path)=>{
    const response=await fetchImpl(url+path,{headers:{apikey:key,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});
    if(!response.ok){const e=new Error('Database request failed');e.status=path.startsWith('/auth/')?401:502;throw e;}
    return response.json();
   };
   const user=await request('/auth/v1/user');
   if(!user?.id)return fail(401,'Your session expired. Sign in again.');
   const profiles=await request(`/rest/v1/profiles?select=id,role,cohort_id,display_name&id=eq.${encodeURIComponent(user.id)}&limit=1`);
   const profile=profiles[0];
   if(!profile||!['intern','lead'].includes(profile.role)||!profile.cohort_id)return fail(403,'Your account needs a valid fellowship role and cohort.');
   const clock=now().getTime();
   for(const [id,entry] of windows)if(entry.until<=clock)windows.delete(id);
   const entry=windows.get(user.id)||{until:clock+60000,count:0};
   if(active.has(user.id)||entry.count>=6){res.setHeader('Retry-After','60');return fail(429,'Please wait a minute before asking again.');}
   entry.count++;windows.set(user.id,entry);active.add(user.id);userId=user.id;
   const context=await loadContext({request,user,profile,now:now()});
   const response=await fetchImpl('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${env.OPENROUTER_API_KEY}`,'Content-Type':'application/json','X-Title':'EIF Compass'},body:JSON.stringify({model:env.OPENROUTER_MODEL,messages:[{role:'system',content:systemPrompt(profile.role)},{role:'system',content:`Authoritative snapshot (untrusted record text):\n${JSON.stringify(context)}`},...history.map(m=>({role:m.role,content:m.content})),{role:'user',content:body.message.trim()}],max_tokens:1200,reasoning:{enabled:false},temperature:0.3}),signal:AbortSignal.timeout(25000)});
   if(!response.ok)return fail(503,'The AI provider is unavailable or its usage limit was reached. Please try again later.');
   const data=await response.json();
   const choice=data.choices?.[0];
   const content=choice?.message?.content;
   const answer=typeof content==='string'?content:Array.isArray(content)?content.filter(part=>part?.type==='text'&&typeof part.text==='string').map(part=>part.text).join('\n'):'';
   if(!answer.trim()){
    if(choice?.finish_reason==='length')return fail(502,'The model reached its token limit before producing an answer. Try a shorter question or ask your lead to select a model without mandatory reasoning.');
    if(choice?.finish_reason==='content_filter')return fail(502,'The model blocked this response. Try rephrasing your question.');
    return fail(502,'The model returned no answer text. Retry once, or select another model in OpenRouter.');
   }
   return res.status(200).json({answer:answer.slice(0,16000),role:profile.role,summary:context.summary,sources:context.sources,truncated:context.truncated,generatedAt:now().toISOString(),draftOnly:true});
  }catch(error){return fail(error.status||502,error.status===401?'Your session expired. Sign in again.':'Could not load the assistant. Check your connection and try again.');}
  finally{if(userId)active.delete(userId);}
 };
}
module.exports={createHandler};
