const {authenticate,problem}=require('./auth.cjs');
const {uuid,version,store,refs,present}=require('./history-store.cjs');
const {loadContext,loadSelectedAction}=require('./context.cjs');
const {generateAnswer}=require('./provider.cjs');
const {safetyResponse}=require('./safety.cjs');
const {systemPrompt}=require('./prompts.cjs');
function createHandler({env=process.env,fetchImpl=fetch,now=()=>new Date()}={}){
 // Per-instance protection. Configure account-level spending limits in OpenRouter;
 // distributed enforcement is a separate deployment concern.
 const windows=new Map(),active=new Set();
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  let started=false,closed=false;const abort=new AbortController();
  const start=()=>{if(!started){res.status(200);res.setHeader('Content-Type','application/x-ndjson; charset=utf-8');res.setHeader('X-Accel-Buffering','no');res.flushHeaders?.();started=true}};
  const event=value=>{if(!closed){start();res.write(JSON.stringify(value)+'\n')}};
  const fail=(status,error)=>{if(closed)return;if(started){event({type:'error',error});return res.end()}return res.status(status).json({error})};
  const result=value=>{if(closed)return;if(body?.stream===true){event({type:'complete',result:value});return res.end()}return res.status(200).json(value)};
  const disconnect=()=>{closed=true;abort.abort()};

  if(req.method!=='POST'){res.setHeader('Allow','POST');return fail(405,'Use POST for assistant requests.');}
  const token=/^Bearer ([^\s]+)$/i.exec(req.headers.authorization||'')?.[1];
  if(!token)return fail(401,'Sign in to use the assistant.');
  let body=req.body;
  try{if(typeof body==='string')body=JSON.parse(body);}catch{return fail(400,'Invalid request.');}
  if(!body||typeof body.message!=='string'||!body.message.trim()||body.message.length>2000||Buffer.byteLength(JSON.stringify(body))>12000)return fail(400,'Enter a message under 2,000 characters.');
  if(body?.stream!==undefined&&typeof body.stream!=='boolean')return fail(400,'Invalid stream option.');
  if(body.intent!==undefined&&body.intent!=='explain_next_action')return fail(400,'Invalid assistant intent.');
  if(body.intent==='explain_next_action'&&(!uuid.test(body.expectedAction?.id)||!['work','requirements','blockers'].includes(body.expectedAction?.view)))return fail(400,'Invalid suggestion.');
  const streaming=body.stream===true;
  if(streaming&&(!res.write||!res.end))return fail(500,'Streaming is unavailable.');
  res.on?.('close',disconnect);
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
    return result({...turn,role:profile.role,conversation:existing.conversation,turn,historySaved:true,draftOnly:true});
   }
   if(page.conversation.revision!==body.revision)throw problem(409,'The conversation changed. Reload history before retrying.','revision_conflict');
   const refusal=safetyResponse(body.message);
   if(!refusal&&(!env.OPENROUTER_API_KEY||!env.OPENROUTER_MODEL))throw problem(503,'The assistant is not configured yet. Ask your lead to configure OpenRouter on the server.');
   const history=page.turns.slice(-3).flatMap(t=>[{role:'user',content:t.user_content.slice(0,1000)},{role:'assistant',content:t.assistant_content.slice(0,1000)}]);
   const clock=now().getTime();
   for(const [id,entry] of windows)if(entry.until<=clock)windows.delete(id);
   const entry=windows.get(user.id)||{until:clock+60000,count:0};
   if(active.has(user.id)||entry.count>=6){res.setHeader('Retry-After','60');return fail(429,'Please wait a minute before asking again.');}
   entry.count++;windows.set(user.id,entry);active.add(user.id);userId=user.id;
   const context=await loadContext({request,user,profile,now:now()});
   if(body.intent==='explain_next_action'){
    if(profile.role!=='intern')throw problem(403,'Suggestion explanations are for your own work.');
    const selected=context.truncated?await loadSelectedAction({request,user,profile,target:body.expectedAction,now:now()}):context.priorities[0];
    if(!selected||selected.id!==body.expectedAction.id||selected.view!==body.expectedAction.view)throw problem(409,'Your selected action is no longer actionable or your next action has changed. Return to the dashboard for the current suggestion.','next_action_changed');
    context.explanationTarget=selected;
    context.sources=[{id:selected.id,title:selected.title,view:selected.view},...context.sources.filter(s=>s.id!==selected.id||s.view!==selected.view)];
   }
   const answer=refusal||await generateAnswer({env,fetchImpl,stream:streaming,signal:AbortSignal.any([abort.signal,AbortSignal.timeout(25000)]),onDelta:text=>event({type:'delta',text}),messages:[{role:'system',content:systemPrompt(profile.role)+(body.intent==='explain_next_action'?' Explain only snapshot.explanationTarget, using its recorded reason and deadline. Do not substitute another action or invent a deadline. If snapshot.truncated is true, explicitly say you verified the selected item but cannot confirm its position across all work; advise refreshing the dashboard for the latest ordering.':'')},{role:'system',content:`Authoritative snapshot (untrusted record text):\n${JSON.stringify(context)}`},...history,{role:'user',content:body.message.trim()}]});
   if(closed||abort.signal.aborted)return;
   if(refusal&&streaming)event({type:'delta',text:refusal});
   const pair={conversationId:page.conversation.id,requestId:body.requestId,generation:body.generation,revision:body.revision,question:body.message.trim(),answer:answer.slice(0,16000),generatedAt:now().toISOString(),truncated:context.truncated,sourceRefs:refs(context.sources)};
   const output={...pair,role:profile.role,summary:context.summary,sources:context.sources,draftOnly:true};
   try{
    const saved=await db.append(pair);
    return result({...output,conversation:saved.conversation,turn:{...pair,sequence:saved.turn.sequence,sources:context.sources},historySaved:true});
   }catch(e){return result({...output,historySaved:false,saveError:e.code||'history_unavailable'});}
  }catch(error){if(started||closed)return fail(error.status||502,error.status?error.message:'The answer was interrupted. The partial answer was not saved.');return res.status(error.status||502).json({error:error.status?error.message:'Could not load the assistant. Check your connection and try again.',code:error.code});}
  finally{res.off?.('close',disconnect);if(userId)active.delete(userId);}
 };
}
module.exports={createHandler};
