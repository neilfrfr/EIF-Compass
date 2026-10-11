const assert=require('node:assert/strict');const {createRemovalHandler}=require('../submissions/remove.cjs');
const id='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',cohort='33333333-3333-4333-8333-333333333333';
const env={APP_URL:'https://compass.test',SUPABASE_URL:'https://db.test',SUPABASE_SECRET_KEY:'sb_secret_test',SUPABASE_PUBLISHABLE_KEY:'public'};
let role='intern',files=[{id,object_path:`${user}/${id}/${id}.pdf`}],failStorage=false;const calls=[];
const handler=createRemovalHandler({env,fetchImpl:async(url,options)=>{calls.push({url,options});let value;if(url.endsWith('/auth/v1/user'))value={id:user};else if(url.includes('/profiles?'))value=[{role,cohort_id:cohort}];else if(url.includes('/requirements?')){assert.equal(options.headers.Authorization,'Bearer user');value=[{id}]}else if(url.includes('/storage/')){assert.equal(options.headers.Authorization,undefined);if(failStorage)return new Response('{}',{status:500});value=[]}else if(url.includes('/submission_files?')){assert.equal(options.headers.apikey,env.SUPABASE_SECRET_KEY);if(options.method==='DELETE'){files=[];return new Response(null,{status:204})}value=files}else throw new Error('Unexpected URL');return new Response(JSON.stringify(value))}});
async function request(extra={}){const req={method:'DELETE',headers:{origin:env.APP_URL,authorization:'Bearer user'},body:{id},...extra};const res={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body}};await handler(req,res);return res}
(async()=>{
 assert.equal((await request()).code,403);assert.equal(calls.some(c=>c.options.headers.apikey===env.SUPABASE_SECRET_KEY),false,'Intern cannot initiate privileged cleanup');
 role='lead';failStorage=true;assert.equal((await request()).code,502);assert.ok(files.length,'Failed Storage removal retains metadata');assert.ok(!calls.some(c=>c.url.includes('/requirements?')&&c.options.method==='DELETE'));
 calls.length=0;failStorage=false;assert.equal((await request()).code,200);assert.equal(files.length,0);
 const methods=calls.filter(c=>!c.url.includes('/auth/')&&!c.url.includes('/profiles?')).map(c=>[c.url.includes('/storage/')?'storage':c.url.includes('/submission_files?')?'files':'requirement',c.options.method]);
 assert.deepEqual(methods,[['requirement','PATCH'],['files','GET'],['storage','DELETE'],['files','DELETE'],['files','GET'],['requirement','DELETE']]);
 console.log('PASS: cohort lead verification, removal lock, Storage-before-metadata ordering and retry-safe cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
