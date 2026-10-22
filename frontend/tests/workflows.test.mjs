import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React, {act} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'
mkdirSync('.test-output',{recursive:true})
for(const name of ['WorkManager','SubmissionBin','submissions','DetailDrawer','motion','StatusBadge']) {
 try { writeFileSync(`.test-output/${name}.js`,ts.transpileModule(readFileSync(`src/${name}.${['submissions','motion'].includes(name)?'ts':'tsx'}`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll("'./SubmissionBin'","'./SubmissionBin.js'").replaceAll("'./submissions'","'./submissions.js'").replaceAll("'./DetailDrawer'","'./DetailDrawer.js'").replaceAll("'./motion'","'./motion.js'").replaceAll("'./StatusBadge'","'./StatusBadge.js'")) } catch(error) { if(name==='WorkManager') throw error }
}
const {default:WorkManager}=await import('../.test-output/WorkManager.js')
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,FormData:dom.window.FormData,IS_REACT_ACT_ENVIRONMENT:true})
const root=createRoot(document.getElementById('root'))
const calls=[]
const fixtures={profiles:[{id:'intern-a',display_name:'Intern A',role:'intern',cohort_id:'cohort'}],projects:[{id:'project-a',team_id:'team-a',title:'Research project'}],sprints:[{id:'sprint-a',project_id:'project-a',title:'Sprint 1',sequence:1}],milestones:[{id:'milestone-a',project_id:'project-a',sprint_id:'sprint-a',title:'Discovery'}],tasks:[{id:'task-a',title:'Assigned task',assignee_id:'intern-a',cohort_id:'cohort',description:'Notes',project_name:'Compass',due_date:'2026-10-07',priority:'high',status:'to_do'},{id:'shared',title:'Shared task',assignee_id:null,cohort_id:'cohort',priority:'low',status:'to_do'}],requirements:[{id:'req-a',title:'Reflection',cohort_id:'cohort',due_date:'2026-10-04',status:'pending',assignee_id:null}],events:[{id:'event-a',title:'Check-in',starts_at:'2026-10-07T14:00:00+08:00',location:'Online',event_type:'Milestone'}],requirement_submissions:[],submission_files:[]}
let failWrite=false, deferReviews=false, holdTaskReads=false
const heldReads=[]
const pendingReviews=[]
globalThis.fetch=async()=>{calls.push({table:'requirements',op:'delete'});return new Response(JSON.stringify(failWrite?{error:'Save denied'}:{data:[{id:'saved'}]}),{status:failWrite?502:200})}
const client={auth:{async getSession(){return {data:{session:{access_token:'test'}}}}},from(table){const q={table,op:'read',payload:null,filters:[],select(){return this},order(){return this},eq(k,v){this.filters.push([k,v]);return this},insert(p){this.op='insert';this.payload=p;return this},update(p){this.op='update';this.payload=p;return this},upsert(p){this.op='upsert';this.payload=p;return this},delete(){this.op='delete';return this},single(){return this},then(resolve,reject){if(holdTaskReads&&this.op==='read'&&this.table==='tasks')return new Promise(done=>heldReads.push(done)).then(()=>({data:fixtures.tasks,error:null})).then(resolve,reject);if(deferReviews&&this.op==='update'&&this.table==='requirement_submissions')return new Promise(done=>pendingReviews.push(done)).then(resolve,reject);if(this.op!=='read')calls.push({table:this.table,op:this.op,payload:this.payload,filters:this.filters});return Promise.resolve(failWrite&&this.op!=='read'?{data:null,error:{message:'Save denied'}}:{data:this.op==='read'?fixtures[table]:(table==='requirement_submissions'?{...this.payload,requirement_id:'req-a',user_id:'intern-a'}:[{id:'saved'}]),error:null}).then(resolve,reject)}};return q}}
const render=async(role,view)=>act(async()=>{root.render(React.createElement(WorkManager,{client,role,view,userId:'intern-a',cohortId:'cohort',onChanged(){}}))})
const click=async(text)=>act(async()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(button,`Missing ${text}`);button.click()})
const submit=async()=>act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}))})
await render('lead','work')
await click('Add task')
assert.ok(document.querySelector('[name="title"]'),'Lead task form missing')
await submit()
assert.equal(calls.length,0,'Empty title must not save')
assert.match(document.body.textContent,/title/i)
await act(async()=>{const priority=document.querySelector('[name="priority"]');priority.value='high';priority.dispatchEvent(new window.Event('change',{bubbles:true}))})
await click('Close')
assert.match(document.body.textContent,/Discard unsaved changes/,'Dirty editor must confirm closure')
await click('Keep editing')
assert.ok(document.querySelector('form'),'Keep editing preserves the form')
document.querySelector('[name="title"]').value=' New task '
document.querySelector('[name="assignee_id"]').value='intern-a'
await submit()
assert.equal(calls.at(-1).payload.title,'New task')
assert.equal(calls.at(-1).payload.cohort_id,'cohort')
assert.equal(calls.at(-1).payload.assignee_id,'intern-a')
await click('Add task')
document.querySelector('[name="title"]').value='Linked task'
document.querySelector('[name="assignee_id"]').value='intern-a'
document.querySelector('[name="sprint_id"]').value='sprint-a'
document.querySelector('[name="milestone_id"]').value='milestone-a'
await submit()
assert.equal(calls.at(-1).payload.sprint_id,'sprint-a')
assert.equal(calls.at(-1).payload.project_id,'project-a')
assert.equal(calls.at(-1).payload.project_team_id,'team-a')
assert.equal(calls.at(-1).payload.milestone_id,'milestone-a')
assert.equal(calls.at(-1).payload.project_name,'Research project')
await click('Add task')
document.querySelector('[name="title"]').value='Project task'
document.querySelector('[name="project_id"]').value='project-a'
await submit()
assert.equal(calls.at(-1).payload.project_id,'project-a')
assert.equal(calls.at(-1).payload.project_team_id,'team-a')
assert.equal(calls.at(-1).payload.sprint_id,null)
await click('Remove')
assert.ok(document.querySelector('[role="region"]'),'Removal confirmation missing')
const beforeCancel=calls.length
await click('Keep task');assert.equal(calls.length,beforeCancel)
await click('Remove');await click('Remove task')
assert.equal(calls.at(-1).op,'delete')
assert.ok(calls.at(-1).filters.some(([k,v])=>k==='cohort_id'&&v==='cohort'))
await render('intern','work')
assert.ok(![...document.querySelectorAll('button')].some(button=>button.textContent==='Reset filters'),'Reset is hidden when filters are inactive')
await act(async()=>{const priority=document.querySelectorAll('.work-filters select')[2];priority.value='high';priority.dispatchEvent(new window.Event('change',{bubbles:true}))})
assert.ok(!document.body.textContent.includes('Shared task'),'Priority filter excludes lower priority tasks')
await click('Assigned task');await click('Close')
assert.equal(document.querySelectorAll('.work-filters select')[2].value,'high','Opening details preserves active filters')
await act(async()=>{const priority=document.querySelectorAll('.work-filters select')[2];priority.value='all';priority.dispatchEvent(new window.Event('change',{bubbles:true}))})
assert.ok(![...document.querySelectorAll('button')].some(b=>b.textContent==='Remove'))
assert.ok(!document.body.textContent.includes('Add task'))
const shared=[...document.querySelectorAll('article')].find(e=>e.textContent.includes('Shared task'))
assert.ok(shared&&!shared.querySelector('select'),'Shared task must not be editable by intern')
const taskTrigger=[...document.querySelectorAll('button')].find(button=>button.textContent==='Assigned task')
taskTrigger.focus()
await click('Assigned task')
assert.ok(document.querySelector('[role="dialog"]'),'Task details open in a dialog')
assert.match(document.querySelector('[role="dialog"]').textContent,/Notes/)
await act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})))
assert.ok(!document.querySelector('[role="dialog"]'),'Escape closes task detail')
assert.equal(document.activeElement,taskTrigger,'Focus returns to task title')
const select=document.querySelector('[aria-label="Status for Assigned task"]')
assert.ok(select)
await act(async()=>{select.value='completed';select.dispatchEvent(new window.Event('change',{bubbles:true}))})
assert.deepEqual(calls.at(-1).payload,{status:'completed'})
assert.ok(calls.at(-1).filters.some(([k,v])=>k==='assignee_id'&&v==='intern-a'))
// Completing under a filter that hides completed work keeps the row for the ~600ms completion animation
const statusFilter=()=>document.querySelectorAll('.work-filters select')[3]
await act(async()=>{statusFilter().value='to_do';statusFilter().dispatchEvent(new window.Event('change',{bubbles:true}))})
const originalTasks=fixtures.tasks,original=originalTasks[0];fixtures.tasks=[{...original,status:'completed'},...originalTasks.slice(1)]
await act(async()=>{const s=document.querySelector('[aria-label="Status for Assigned task"]');s.value='completed';s.dispatchEvent(new window.Event('change',{bubbles:true}))})
assert.match(document.body.textContent,/Task status saved\./,'Existing toast text is unchanged')
const completing=[...document.querySelectorAll('article')].find(e=>e.textContent.includes('Assigned task'))
assert.ok(completing?.classList.contains('is-completing'),'Completed row stays with .is-completing while the filter would hide it')
await act(async()=>new Promise(r=>setTimeout(r,650)))
assert.ok(![...document.querySelectorAll('article')].some(e=>e.textContent.includes('Assigned task')),'Row leaves once the animation ends')
fixtures.tasks=originalTasks
await click('Refresh')
// The reload after saving keeps the list on screen; the hold lasts ~600ms past the reload, not just past the save
await act(async()=>{statusFilter().value='all';statusFilter().dispatchEvent(new window.Event('change',{bubbles:true}))})
await act(async()=>{statusFilter().value='to_do';statusFilter().dispatchEvent(new window.Event('change',{bubbles:true}))})
holdTaskReads=true;fixtures.tasks=[{...original,status:'completed'},...originalTasks.slice(1)]
await act(async()=>{const s=document.querySelector('[aria-label="Status for Assigned task"]');s.value='completed';s.dispatchEvent(new window.Event('change',{bubbles:true}))})
assert.equal(heldReads.length,1,'Reload is in flight')
assert.ok(!document.body.textContent.includes('Loading tasks'),'A refresh keeps the list instead of the loading line')
const row=()=>[...document.querySelectorAll('article')].find(e=>e.textContent.includes('Assigned task'))
assert.ok(row()?.classList.contains('is-completing'),'Row holds with .is-completing while the reload is pending')
await act(async()=>new Promise(r=>setTimeout(r,650)))
assert.ok(row(),'Row is still listed while the reload is pending')
holdTaskReads=false;await act(async()=>heldReads.shift()())
assert.ok(row()?.classList.contains('is-completing'),'Row still holds right after the reload hides it')
await act(async()=>new Promise(r=>setTimeout(r,650)))
assert.ok(!row(),'Row leaves ~600ms after the reload resolves')
fixtures.tasks=originalTasks
await act(async()=>{statusFilter().value='all';statusFilter().dispatchEvent(new window.Event('change',{bubbles:true}))})
await render('lead','work')
const statusTexts=new Set(['To do','In progress','For review','Completed','Pending','Under review','In review','Overdue','Upcoming'])
const badges=[...document.querySelectorAll('.status-badge')]
assert.ok(badges.length>0,'Task statuses render as badges')
for(const badge of badges){assert.ok(badge.querySelector('svg'),'Status badge has an icon');assert.ok(statusTexts.has(badge.textContent.trim()),`Status badge has text: ${badge.textContent}`)}
assert.ok(![...document.querySelectorAll('.data-pill')].some(pill=>statusTexts.has(pill.textContent.trim())),'No status is shown without an icon')
// A parent-driven close (successful save) plays the drawer exit, then unmounts and restores the page
let finishExit
window.HTMLElement.prototype.getAnimations=function(){return this.classList.contains('detail-drawer')&&this.closest('.is-closing')?[{finished:new Promise(r=>{finishExit=r})}]:[]}
await click('Add task');document.querySelector('[name="title"]').value='Animated close';await submit()
assert.equal(calls.at(-1).payload.title,'Animated close')
assert.ok(document.querySelector('.detail-overlay.is-closing [role="dialog"]'),'Saved editor plays its exit before unmounting')
await act(async()=>finishExit())
assert.ok(!document.querySelector('[role="dialog"]'),'Drawer unmounts once the exit finishes')
assert.ok(!document.getElementById('root').inert,'Siblings are no longer inert')
delete window.HTMLElement.prototype.getAnimations
await click('Edit')
assert.equal(document.querySelector('[name="title"]').value,'Assigned task')
document.querySelector('[name="title"]').value='Edited from form';await submit()
assert.equal(calls.at(-1).op,'update');assert.equal(calls.at(-1).payload.title,'Edited from form')
fixtures.requirement_submissions=[{requirement_id:'req-a',user_id:'intern-a',submission_url:'https://example.com/reflection',status:'in_review',reviewed_at:null}]
await render('intern','requirements')
assert.ok(document.querySelector('.work-row .status-badge svg'),'Intern requirement status is an icon badge')
await render('lead','requirements');await click('Review submissions')
assert.ok(document.querySelector('.submission-bin .status-badge svg'),'Submission status is an icon badge')
await click('Approve');await click('Close')
assert.deepEqual(calls.at(-1).payload,{status:'completed'})
assert.ok(calls.at(-1).filters.some(([k,v])=>k==='user_id'&&v==='intern-a'))
fixtures.requirement_submissions.push({requirement_id:'req-a',user_id:'intern-b',status:'in_review'})
await render('lead','work');await render('lead','requirements');await click('Review submissions')
deferReviews=true
await act(async()=>[...document.querySelectorAll('button')].filter(button=>button.textContent==='Approve').forEach(button=>button.click()))
assert.equal(pendingReviews.length,2,'Both lead review actions start independently')
const closeDrawer=()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Close')
assert.equal(closeDrawer().disabled,true,'Pending reviews prevent drawer closure')
await act(async()=>pendingReviews[0]({data:{...fixtures.requirement_submissions[0],status:'completed'},error:null}))
assert.equal(closeDrawer().disabled,true,'Completing first review keeps drawer protected while second review is pending')
await act(async()=>pendingReviews[1]({data:{...fixtures.requirement_submissions[1],status:'completed'},error:null}))
assert.equal(closeDrawer().disabled,false,'Drawer unlocks only after every review finishes')
deferReviews=false
await click('Close')
await click('Edit');document.querySelector('[name="due_at"]').value='2099-01-02T14:00';await submit();assert.equal(calls.at(-1).payload.due_at,'2099-01-02T06:00:00.000Z');
await click('Edit');document.querySelector('[name="due_at"]').value='';await submit();assert.equal(calls.at(-1).payload.due_at,null,'Date-only edit clears exact cutoff');
await click('Add requirement');document.querySelector('[name="title"]').value='New requirement';await submit()
assert.equal(calls.at(-1).table,'requirements');assert.equal(calls.at(-1).payload.assignee_id,null)
await render('lead','calendar');await click('Add event')
document.querySelector('[name="title"]').value='Event'
document.querySelector('[name="starts_at"]').value='2026-10-07T14:00'
await submit()
assert.equal(calls.at(-1).payload.starts_at,'2026-10-07T06:00:00.000Z')
await click('Add event');document.querySelector('[name="title"]').value='Retry event';document.querySelector('[name="starts_at"]').value='2026-10-07T14:00'
failWrite=true;await submit()
assert.match(document.body.textContent,/Save denied/)
assert.ok(document.querySelector('form'),'Failed save must retain form')
failWrite=false
for(const [view,singular,table] of [['requirements','requirement','requirements'],['calendar','event','events']]){
 await render('lead',view);await click('Remove')
 if(table==='requirements')assert.match(document.body.textContent,/submissions will also be removed/)
 failWrite=true;await click(`Remove ${singular}`)
 assert.ok(document.querySelector('[role="region"]'),'Failed removal must retain confirmation')
 failWrite=false;await click(`Remove ${singular}`)
 assert.equal(calls.at(-1).op,'delete');assert.equal(calls.at(-1).table,table)
 assert.ok(!document.querySelector('[role="region"]'))
 await render('intern',view)
 assert.ok(![...document.querySelectorAll('button')].some(b=>b.textContent==='Remove'))
}
await act(async()=>root.unmount())
console.log('PASS: role controls, form validation, create payload, own task status, safe submission, error recovery')
