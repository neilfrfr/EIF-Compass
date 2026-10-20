const fs=require('node:fs'),assert=require('node:assert/strict');const {PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,storage to anon,authenticated,service_role;grant execute on function auth.uid() to public;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);
 await db.exec(fs.readFileSync('backend/supabase/schema.sql','utf8').replace('create extension if not exists pgcrypto;',''));

const files=fs.readdirSync('backend/supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
assert.ok(files.every(f=>/^\d{14}_[a-z0-9_]+[.]sql$/.test(f)),'Use unique full timestamp versions');assert.equal(new Set(files.map(f=>f.split('_')[0])).size,files.length);
for(const f of files)await db.exec(fs.readFileSync('backend/supabase/migrations/'+f,'utf8'));
if(process.env.MIGRATION_CATALOG_QUERY){const rows=(await db.query(fs.readFileSync(process.env.MIGRATION_CATALOG_QUERY,'utf8'))).rows;fs.writeFileSync('/tmp/replay-migration-catalog.json',JSON.stringify(rows));}
// Exercise metadata repair against fixture history; platform owners/ACLs differ.
const catalogSql=fs.readFileSync('backend/supabase/operations/2026-10-20-repair-history.sql','utf8');
const snapshotQuery=catalogSql.match(/with snapshot as \(([\s\S]*?)\)\n select md5/)[1];
const fingerprint=async()=>(await db.query(`with snapshot as (${snapshotQuery}) select md5(jsonb_agg(to_jsonb(snapshot) order by kind,name)::text) as value from snapshot`)).rows[0].value;
const before=await fingerprint();
await db.exec('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);');
const original=files.filter(f=>!['20261011060705','20261020115000','20261020121308'].includes(f.split('_')[0]));
for(const f of original)await db.query('insert into supabase_migrations.schema_migrations values($1,$2,$3)',[f.split('_')[0],f.slice(15,-4),[fs.readFileSync('backend/supabase/migrations/'+f,'utf8')]]);
const ledgerHash=(await db.query("select md5(jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',statements) order by version)::text) as value from supabase_migrations.schema_migrations")).rows[0].value;
const repair=catalogSql.replace('2c1e63f9cf19a9b639c695799272b32f',before).replace('69b8351a76bb4369510382441381d1e4',ledgerHash);
await db.exec(repair);await db.exec(repair);
assert.equal((await db.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,files.length,'Repair is idempotent');assert.equal(await fingerprint(),before,'Repair must leave application schema unchanged');
await db.exec("update supabase_migrations.schema_migrations set name='conflict' where version='20261020115000'");
await assert.rejects(()=>db.exec(repair),/Conflicting ledger/);await db.exec('rollback');
await db.exec("update supabase_migrations.schema_migrations set name='assistant_history' where version='20261020115000';update supabase_migrations.schema_migrations set name='changed' where version='20261005135713'");
await assert.rejects(()=>db.exec(repair),/Original ledger changed/);await db.exec('rollback');
await db.exec("update supabase_migrations.schema_migrations set name='lead_workflows' where version='20261005135713';alter table public.assistant_turns add column unexpected text");
await assert.rejects(()=>db.exec(repair),/Schema changed/);await db.exec('rollback');
console.log('PASS: ledger repair is idempotent, rejects conflicts and leaves schema unchanged');
console.log('PASS: base schema and all '+files.length+' uniquely versioned migrations replay in chronological order');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exitCode=1});
