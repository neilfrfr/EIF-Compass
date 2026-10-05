import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React, {act} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'
mkdirSync('.test-output',{recursive:true})
for(const name of ['WorkManager','workflow']) {
 try { writeFileSync(`.test-output/${name}.js`,ts.transpileModule(readFileSync(`src/${name}.tsx`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("'./workflow'","'./workflow.js'")) } catch(error) { if(name==='WorkManager') throw error }
}
const {default:WorkManager}=await import('../.test-output/WorkManager.js')
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,FormData:dom.window.FormData,IS_REACT_ACT_ENVIRONMENT:true})
const root=createRoot(document.getElementById('root'))
const calls=[]
const fixtures={profiles:[{id:'intern-a',display_name:'Intern A',role:'intern',cohort_id:'cohort'}],tasks:[{id:'task-a',title:'Assigned task',assignee_id:'intern-a',cohort_id:'cohort',description:'Notes',project_name:'Compass',due_date:'2026-10-07',priority:'high',status:'to_do'},{id:'shared',title:'Shared task',assignee_id:null,cohort_id:'cohort',priority:'low',status:'to_do'}],requirements:[{id:'req-a',title:'Reflection',cohort_id:'cohort',due_date:'2026-10-04',status:'pending',assignee_id:null}],events:[{id:'event-a',title:'Check-in',starts_at:'2026-10-07T14:00:00+08:00',location:'Online',event_type:'Milestone'}],requirement_submissions:[]}
let failWrite=false
const client={from(table){const q={table,op:'read',payload:null,filters:[],select(){return this},order(){return this},eq(k,v){this.filters.push([k,v]);return this},insert(p){this.op='insert';this.payload=p;return this},update(p){this.op='update';this.payload=p;return this},upsert(p){this.op='upsert';this.payload=p;return this},then(resolve,reject){if(this.op!=='read')calls.push({table:this.table,op:this.op,payload:this.payload,filters:this.filters});return Promise.resolve(failWrite&&this.op!=='read'?{data:null,error:{message:'Save denied'}}:{data:this.op==='read'?fixtures[table]:[{id:'saved'}],error:null}).then(resolve,reject)}};return q}}
const render=async(role,view)=>act(async()=>{root.render(React.createElement(WorkManager,{client,role,view,userId:'intern-a',cohortId:'cohort',onChanged(){}}))})
const click=async(text)=>act(async()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(button,`Missing ${text}`);button.click()})
const submit=async()=>act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}))})
await render('lead','work')
await click('Add task')
assert.ok(document.querySelector('[name="title"]'),'Lead task form missing')
await submit()
assert.equal(calls.length,0,'Empty title must not save')
assert.match(document.body.textContent,/title/i)
document.querySelector('[name="title"]').value=' New task '
document.querySelector('[name="assignee_id"]').value='intern-a'
await submit()
assert.equal(calls.at(-1).payload.title,'New task')
assert.equal(calls.at(-1).payload.cohort_id,'cohort')
assert.equal(calls.at(-1).payload.assignee_id,'intern-a')
await render('intern','work')
assert.ok(!document.body.textContent.includes('Add task'))
const shared=[...document.querySelectorAll('article')].find(e=>e.textContent.includes('Shared task'))
assert.ok(shared&&!shared.querySelector('select'),'Shared task must not be editable by intern')
const select=document.querySelector('[aria-label="Status for Assigned task"]')
assert.ok(select)
await act(async()=>{select.value='completed';select.dispatchEvent(new window.Event('change',{bubbles:true}))})
assert.deepEqual(calls.at(-1).payload,{status:'completed'})
assert.ok(calls.at(-1).filters.some(([k,v])=>k==='assignee_id'&&v==='intern-a'))
await render('intern','requirements')
await click('Submit link')
document.querySelector('[name="submission_url"]').value='javascript:alert(1)'
const before=calls.length
await submit();assert.equal(calls.length,before,'Unsafe link saved')
document.querySelector('[name="submission_url"]').value='https://example.com/reflection'
await submit();assert.equal(calls.at(-1).payload.status,'in_review');assert.equal(calls.at(-1).payload.user_id,'intern-a')
await render('lead','work');await click('Edit')
assert.equal(document.querySelector('[name="title"]').value,'Assigned task')
document.querySelector('[name="title"]').value='Edited from form';await submit()
assert.equal(calls.at(-1).op,'update');assert.equal(calls.at(-1).payload.title,'Edited from form')
fixtures.requirement_submissions=[{requirement_id:'req-a',user_id:'intern-a',submission_url:'https://example.com/reflection',status:'in_review',reviewed_at:null}]
await render('lead','requirements');await click('Approve')
assert.deepEqual(calls.at(-1).payload,{status:'completed'})
assert.ok(calls.at(-1).filters.some(([k,v])=>k==='user_id'&&v==='intern-a'))
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
await act(async()=>root.unmount())
console.log('PASS: role controls, form validation, create payload, own task status, safe submission, error recovery')
