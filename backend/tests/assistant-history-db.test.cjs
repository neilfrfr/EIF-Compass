const assert=require('node:assert/strict'),fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,storage to anon,authenticated,service_role;grant execute on function auth.uid() to public;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);
 await db.exec(fs.readFileSync('backend/supabase/schema.sql','utf8').replace('create extension if not exists pgcrypto;',''));
 for(const f of ['20261005_lead_workflows.sql','20261005_lead_removal.sql','20261005_restrict_helpers.sql','20261011060705_calendar_submission_bin.sql'])await db.exec(fs.readFileSync('backend/supabase/migrations/'+f,'utf8'));

const migration=fs.readdirSync('backend/supabase/migrations').find(f=>f.endsWith('_assistant_history.sql'));if(migration)await db.exec(fs.readFileSync('backend/supabase/migrations/'+migration,'utf8'));
const id=n=>`bb000000-0000-4000-8000-${String(n).padStart(12,'0')}`;const u=id(1),other=id(2),lead=id(3);await db.exec(`insert into auth.users(id,email)values('${u}','a@test'),('${other}','b@test'),('${lead}','l@test');update profiles set role='lead' where id='${lead}';`);
const login=async user=>db.exec(`reset role;set request.jwt.claim.sub='${user}';set role authenticated;`);
const rpc=async(name,args='')=>(await db.query(`select public.${name}(${args}) as value`)).rows[0].value;
await login(u);let page=await rpc('eif_assistant_load');assert.equal(page.turns.length,0);const convo=page.conversation.id;
const append=(n,g=0,r=n-1,text='Answer')=>rpc('eif_assistant_append',`'${id(100+n)}',${g},${r},'Question','${text}','2026-10-20T10:00:00Z',false,'[]','${convo}'`);
let result=await append(1);assert.equal(result.conversation.revision,1);assert.equal((await append(1)).turn.id,result.turn.id,'Idempotent replay');
await assert.rejects(()=>append(1,0,0,'Changed'),/different|conflict/i);await assert.rejects(()=>append(2,0,0),/revision|conflict/i);
for(let n=2;n<=21;n++)await append(n);
page=await rpc('eif_assistant_load');assert.equal(page.turns.length,20);assert.equal(page.turns[0].sequence,2);assert.equal(page.has_more,true);assert.equal((await rpc('eif_assistant_load',`${page.next_before},0`)).turns.length,1);
await assert.rejects(()=>db.exec(`update public.assistant_conversations set user_id='${other}'`));await assert.rejects(()=>db.exec(`insert into public.assistant_turns(conversation_id,request_id,sequence,user_content,assistant_content,generated_at)values('${convo}','${id(999)}',22,'x','y',now())`));
await login(other);assert.equal((await db.query(`select * from public.assistant_turns where conversation_id='${convo}'`)).rows.length,0);
await login(lead);assert.equal((await db.query(`select * from public.assistant_turns where conversation_id='${convo}'`)).rows.length,0);
await login(u);await rpc('eif_assistant_clear',`0,21,'${convo}'`);page=await rpc('eif_assistant_load');assert.equal(page.conversation.generation,1);assert.equal(page.turns.length,0);
await assert.rejects(()=>append(1,0,0),/generation|cleared/i);await assert.rejects(()=>rpc('eif_assistant_load','2,0'),/generation|cleared/i);
await db.exec(`reset role;set request.jwt.claim.sub='';update profiles set role='lead' where id='${u}';`);await login(u);assert.equal((await db.query(`select * from assistant_conversations where id='${convo}'`)).rows.length,0);
await assert.rejects(()=>append(30,0,0),/scope/i);await assert.rejects(()=>rpc('eif_assistant_clear',`0,0,'${convo}'`),/scope/i);
const newPage=await rpc('eif_assistant_load');assert.notEqual(newPage.conversation.id,convo);
await db.exec(`reset role;set request.jwt.claim.sub='';insert into cohorts(id,name,starts_on,ends_on)values('${id(88)}','Other cohort','2026-10-01','2026-11-01');update profiles set cohort_id='${id(88)}' where id='${u}';`);
await login(u);assert.equal((await db.query(`select * from assistant_conversations where id='${newPage.conversation.id}'`)).rows.length,0);
await assert.rejects(()=>append(31,0,0),/scope/i);
await db.exec(`reset role;set request.jwt.claim.sub='';delete from auth.users where id='${u}';`);
assert.equal((await db.query(`select * from assistant_conversations where user_id='${u}'`)).rows.length,0,'Account deletion cascades history');

await db.exec(`reset role;set request.jwt.claim.sub='';set role anon;`);await assert.rejects(()=>rpc('eif_assistant_load'));
console.log('PASS: private history, role isolation, atomic pairs, paging, idempotency and clear generation');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exitCode=1});
