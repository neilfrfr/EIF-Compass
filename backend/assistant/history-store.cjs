const {problem}=require('./auth.cjs');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const views={work:'tasks',requirements:'requirements',calendar:'events',projects:'projects',feedback:'sprint_feedback',blockers:'blockers'};
function version(body){if(!Number.isSafeInteger(body?.generation)||body.generation<0||!Number.isSafeInteger(body?.revision)||body.revision<0)throw problem(400,'Invalid conversation version.');}
function pair(body){
 version(body);
 if(!uuid.test(body.conversationId)||!uuid.test(body.requestId)||typeof body.question!=='string'||!body.question.trim()||body.question.length>2000||typeof body.answer!=='string'||!body.answer.trim()||body.answer.length>16000||typeof body.generatedAt!=='string'||!Number.isFinite(Date.parse(body.generatedAt))||typeof body.truncated!=='boolean'||!Array.isArray(body.sourceRefs)||body.sourceRefs.length>240||body.sourceRefs.some(s=>!s||!uuid.test(s.id)||!Object.hasOwn(views,s.view)||Object.keys(s).some(k=>!['id','view'].includes(k))))throw problem(400,'Invalid answer to save.');
}
const refs=sources=>(sources||[]).filter(s=>uuid.test(s.id)&&Object.hasOwn(views,s.view)).slice(0,240).map(({id,view})=>({id,view}));
function store(request){
 const rpc=(name,args)=>request('/rest/v1/rpc/eif_assistant_'+name,args);
 return {
  load:(before=null,generation=null)=>rpc('load',{before_sequence:before,expected_generation:generation}),
  find:(id,generation)=>rpc('find',{request_id:id,expected_generation:generation}),
  append:b=>rpc('append',{request_id:b.requestId,expected_generation:b.generation,expected_revision:b.revision,user_content:b.question,assistant_content:b.answer,generated_at:b.generatedAt,truncated:b.truncated,source_refs:b.sourceRefs,expected_conversation:b.conversationId}),
  clear:b=>rpc('clear',{expected_generation:b.generation,expected_revision:b.revision,expected_conversation:b.conversationId||b.id}),
 };
}
async function present(request,turns){
 const labels=new Map();
 for(const [view,table] of Object.entries(views)){
  const ids=[...new Set(turns.flatMap(t=>(t.source_refs||[]).filter(s=>s.view===view).map(s=>s.id)).filter(id=>uuid.test(id)))];
  for(let i=0;i<ids.length;i+=100){
   const fixed=view==='feedback'?'Sprint feedback':view==='blockers'?'Blocker':null;
   const rows=await request(`/rest/v1/${table}?select=id${fixed?'':',title'}&id=in.(${ids.slice(i,i+100).join(',')})&limit=100`);
   for(const row of rows)labels.set(view+':'+row.id,{id:row.id,view,title:fixed||String(row.title||'Record').slice(0,180)});
  }
 }
 return turns.map(t=>({requestId:t.request_id,sequence:t.sequence,question:t.user_content,answer:t.assistant_content,generatedAt:t.generated_at,truncated:t.truncated,sourceRefs:t.source_refs,sources:(t.source_refs||[]).map(s=>labels.get(s.view+':'+s.id)).filter(Boolean)}));
}
module.exports={uuid,version,pair,refs,store,present};
