const {authenticate,problem}=require('./auth.cjs');
const {uuid,version,store,refs,present}=require('./history-store.cjs');
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
  if(!body||typeof body.message!=='string'||!body.message.trim()||body.message.length>2000||Buffer.byteLength(JSON.stringify(body))>12000)return fail(400,'Enter a message under 2,000 characters.');
  let userId;
  try{
   const {request,user,profile}=await authenticate(req,{env,fetchImpl});
   version(body);if(!uuid.test(body.requestId))throw problem(400,'Invalid request identifier.');
   const db=store(request),page=await db.load(null,body.generation);
   if(body.conversationId!==page.conversation.id)throw problem(409,'Your conversation scope changed. Reload history.','generation_conflict');
   const existing=await db.find(body.requestId,body.generation);
   if(existing){
    if(existing.turn.user_content!==body.message.trim())throw problem(400,'Request ID has different content.');
    const turn=(await present(request,[existing.turn]))[0];
    return res.status(200).json({...turn,role:profile.role,conversation:existing.conversation,turn,historySaved:true,draftOnly:true});
   }
   if(page.conversation.revision!==body.revision)throw problem(409,'The conversation changed. Reload history before retrying.','revision_conflict');
   if(!env.OPENROUTER_API_KEY||!env.OPENROUTER_MODEL)throw problem(503,'The assistant is not configured yet. Ask your lead to configure OpenRouter on the server.');
   const history=page.turns.slice(-3).flatMap(t=>[{role:'user',content:t.user_content.slice(0,1000)},{role:'assistant',content:t.assistant_content.slice(0,1000)}]);
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
   const pair={conversationId:page.conversation.id,requestId:body.requestId,generation:body.generation,revision:body.revision,question:body.message.trim(),answer:answer.slice(0,16000),generatedAt:now().toISOString(),truncated:context.truncated,sourceRefs:refs(context.sources)};
   const output={...pair,role:profile.role,summary:context.summary,sources:context.sources,draftOnly:true};
   try{
    const saved=await db.append(pair);
    return res.status(200).json({...output,conversation:saved.conversation,turn:{...pair,sequence:saved.turn.sequence,sources:context.sources},historySaved:true});
   }catch(e){return res.status(200).json({...output,historySaved:false,saveError:e.code||'history_unavailable'});}
  }catch(error){return res.status(error.status||502).json({error:error.status?error.message:'Could not load the assistant. Check your connection and try again.',code:error.code});}
  finally{if(userId)active.delete(userId);}
 };
}
module.exports={createHandler};
