const assert=require('node:assert/strict');const {loadContext}=require('../assistant/context.cjs');
(async()=>{
const queries=[];const context=await loadContext({user:{id:'u'},profile:{role:'intern',cohort_id:'c'},now:new Date('2026-10-06T00:00:00Z'),request:async path=>{queries.push(path);return path.includes('/ai_knowledge?')?[{id:'ok',title:'Submission rules',content:'Use a link.',status:'published',audience:'both',version:2},{id:'draft',title:'Private draft',content:'Hidden',status:'draft',audience:'both'},{id:'lead',title:'Lead only',content:'Hidden',status:'published',audience:'lead'}]:[]}});
assert.equal(context.knowledge.length,1);assert.equal(context.knowledge[0].version,2);assert.ok(queries.some(q=>q.includes('status=eq.published')&&q.includes('cohort_id=eq.c')));assert.ok(!JSON.stringify(context).includes('Hidden'));
console.log('PASS: only published cohort/audience guidance enters assistant context');
})().catch(e=>{console.error(e);process.exitCode=1});
