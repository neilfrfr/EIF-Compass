import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'

mkdirSync('.test-output',{recursive:true})
for(const name of ['Agenda','InternFlows'])writeFileSync(`.test-output/${name}.js`,ts.transpileModule(readFileSync(`src/${name}.tsx`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText)
const {default:Agenda}=await import('../.test-output/Agenda.js')
const {default:InternFlows}=await import('../.test-output/InternFlows.js')
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,FormData:dom.window.FormData,IS_REACT_ACT_ENVIRONMENT:true})
const root=createRoot(document.getElementById('root'))
const records={
 projects:[{id:'project',cohort_id:'cohort',team_id:'team',title:'Research project'}],teams:[{id:'team',cohort_id:'cohort',name:'Research team'}],team_memberships:[{id:'member',cohort_id:'cohort',team_id:'team',user_id:'intern'}],profiles:[{id:'intern',cohort_id:'cohort',display_name:'Test intern'}],
 sprints:[{id:'sprint',cohort_id:'cohort',project_id:'project',title:'Sprint 1',sequence:1,starts_on:'2026-10-01',ends_on:'2026-10-20'}],milestones:[{id:'milestone',cohort_id:'cohort',project_id:'project',status:'completed',title:'Discovery'}],tasks:[{id:'task',cohort_id:'cohort',project_id:'project',status:'completed'}],
 sprint_feedback:[{id:'feedback',cohort_id:'cohort',project_id:'project',sprint_id:'sprint',author_id:'lead',body:'Good progress',created_at:'2026-10-12T00:00:00Z'}],blockers:[],blocker_comments:[],notifications:[{id:'notice',cohort_id:'cohort',recipient_id:'intern',title:'New feedback',type:'feedback',read_at:null,created_at:'2026-10-12T00:00:00Z'}],
 events:[{id:'event',cohort_id:'cohort',title:'Check-in',starts_at:'2026-10-15T06:00:00Z'}],requirements:[{id:'requirement',cohort_id:'cohort',title:'Project brief',due_date:'2026-10-14'}]
}
const client={from(table){const q={table,op:'read',payload:null,filters:[],select(){return this},eq(k,v){this.filters.push([k,v]);return this},insert(p){this.op='insert';this.payload=p;return this},update(p){this.op='update';this.payload=p;return this},then(resolve,reject){let data=records[table].filter(row=>this.filters.every(([k,v])=>row[k]===v));if(this.op==='insert'){const row={id:`new-${records[table].length}`,created_at:'2026-10-13T00:00:00Z',...this.payload};records[table].push(row);data=[row]}if(this.op==='update'){data.forEach(row=>Object.assign(row,this.payload))}return Promise.resolve({data,error:null}).then(resolve,reject)}};return q}}
const render=async(view)=>act(async()=>root.render(React.createElement(InternFlows,{key:view,client,role:'intern',view,userId:'intern',cohortId:'cohort',onChanged(){}})))
await render('projects')
assert.match(document.body.textContent,/Research team/)
assert.match(document.body.textContent,/1\/1 completed/)
await render('feedback')
assert.match(document.body.textContent,/Good progress/)
assert.match(document.body.textContent,/Fellowship lead/)
await render('blockers')
document.querySelector('[name="description"]').value='Need access to data'
await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))
assert.equal(records.blockers[0].description,'Need access to data')
assert.match(document.body.textContent,/Opened/)
document.querySelector('[name="body"]').value='Asked lead for access'
await act(async()=>document.querySelectorAll('form')[1].dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))
assert.equal(records.blocker_comments[0].body,'Asked lead for access')
await render('notifications')
assert.match(document.body.textContent,/Unread/)
await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Mark as read').click())
assert.ok(records.notifications[0].read_at)
await render('projects');await render('notifications')
assert.match(document.body.textContent,/Read/)
assert.ok(!document.body.textContent.includes('Unread'))
await act(async()=>root.render(React.createElement(Agenda,{client,cohortId:'cohort',revision:0})))
assert.ok(document.body.textContent.indexOf('Project brief')<document.body.textContent.indexOf('Check-in'))
await act(async()=>root.unmount())
console.log('PASS: project progress, feedback, blocker comments, persisted notice state, chronological agenda')
