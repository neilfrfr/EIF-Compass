const assert=require('node:assert/strict');
(async()=>{
 const {systemPrompt}=require('../assistant/prompts.cjs');
 assert.match(systemPrompt('lead'),/never grade, rank, score or penalize interns/i);
 const {requirementState,rankActions}=await import('../../shared/workflow-rules.mjs');
 const now=new Date('2026-10-20T12:00:00Z'),r={id:'r',title:'Future',assignee_id:'u',due_at:'2026-10-22T12:00:00Z',status:'pending'};
 assert.equal(requirementState(r,'u',[],now),'upcoming');
 assert.equal(requirementState({...r,due_at:'2026-10-21T12:00:00Z'},'u',[],now),'pending');
 assert.equal(requirementState(r,'u',[{requirement_id:'r',user_id:'u',status:'draft'}],now),'pending');
 assert.equal(requirementState({...r,due_at:now.toISOString()},'u',[],now),'overdue');
 assert.equal(requirementState({...r,due_at:now.toISOString()},'u',[{requirement_id:'r',user_id:'u',status:'in_review'}],now),'in_review');
 assert.equal(rankActions({tasks:[],requirements:[r],submissions:[],role:'intern',userId:'u'},now)[0].id,'r');
 console.log('PASS: explicit AI policy and consistent requirement status boundaries');
})().catch(e=>{console.error(e);process.exitCode=1});
