const assert=require('node:assert/strict');
const {createHandler}=require('../assistant/handler.cjs');
async function run(provider){
 let sent;
 const handler=createHandler({env:{SUPABASE_URL:'https://db.example',SUPABASE_PUBLISHABLE_KEY:'public',OPENROUTER_API_KEY:'fixture',OPENROUTER_MODEL:'openrouter/free'},fetchImpl:async(url,options)=>{
  if(url.includes('openrouter.ai')){sent=JSON.parse(options.body);return new Response(JSON.stringify(provider));}
  let data=[];if(url.includes('/auth/'))data={id:'u'};else if(url.includes('/profiles?')&&url.includes('id=eq.'))data=[{id:'u',role:'lead',cohort_id:'c'}];
  return new Response(JSON.stringify(data));
 }});
 const res={statusCode:200,setHeader(){},status(c){this.statusCode=c;return this},json(v){this.body=v}};
 await handler({method:'POST',headers:{authorization:'Bearer session'},body:{message:'Brief my cohort'}},res);
 return {res,sent};
}
(async()=>{
 const normal=await run({choices:[{message:{content:[{type:'text',text:'Your cohort briefing.'}]},finish_reason:'stop'}]});
 assert.equal(normal.res.statusCode,200,'Text content blocks must be accepted');
 assert.equal(normal.res.body.answer,'Your cohort briefing.');assert.equal(normal.sent.reasoning.enabled,false);
 const limited=await run({choices:[{message:{content:null,reasoning:'PRIVATE THOUGHT'},finish_reason:'length'}]});
 assert.match(limited.res.body.error,/token limit/);assert.ok(!JSON.stringify(limited.res.body).includes('PRIVATE THOUGHT'));
 const blocked=await run({choices:[{message:{content:null},finish_reason:'content_filter'}]});assert.match(blocked.res.body.error,/blocked/);
 console.log('PASS: text blocks, disabled optional reasoning, token-limit diagnostics and hidden reasoning');
})().catch(e=>{console.error(e);process.exitCode=1});
