import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'

mkdirSync('.test-output',{recursive:true})
for(const name of ['Agenda','InternFlows','StatusBadge','motion'])writeFileSync(`.test-output/${name}.js`,ts.transpileModule(readFileSync(`src/${name}.${name==='motion'?'ts':'tsx'}`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll("'./StatusBadge'","'./StatusBadge.js'").replaceAll("'./motion'","'./motion.js'"))
const {default:Agenda}=await import('../.test-output/Agenda.js')
const {default:InternFlows}=await import('../.test-output/InternFlows.js')
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,FormData:dom.window.FormData,IS_REACT_ACT_ENVIRONMENT:true})
const root=createRoot(document.getElementById('root'))
const records={
 projects:[{id:'project',cohort_id:'cohort',team_id:'team',title:'Research project'}],teams:[{id:'team',cohort_id:'cohort',name:'Research team'}],team_memberships:[{id:'member',cohort_id:'cohort',team_id:'team',user_id:'intern'}],profiles:[{id:'intern',cohort_id:'cohort',display_name:'Test intern',role:'intern'},{id:'lead',cohort_id:'cohort',display_name:'Test lead',role:'lead'}],
 sprints:[{id:'sprint',cohort_id:'cohort',project_id:'project',title:'Sprint 1',sequence:1,starts_on:'2026-10-01',ends_on:'2026-10-20'}],milestones:[{id:'milestone',cohort_id:'cohort',project_id:'project',status:'in_progress',title:'Discovery'}],tasks:[{id:'task',cohort_id:'cohort',project_id:'project',status:'completed'}],
 sprint_feedback:[{id:'feedback',cohort_id:'cohort',project_id:'project',sprint_id:'sprint',author_id:'lead',body:'Good progress',created_at:'2026-10-12T00:00:00Z'}],blockers:[],blocker_comments:[],notifications:[{id:'notice',cohort_id:'cohort',recipient_id:'intern',title:'New feedback',type:'feedback',reference_type:'feedback',reference_id:'feedback',read_at:null,created_at:'2026-10-12T00:00:00Z'}],
 events:[{id:'event',cohort_id:'cohort',title:'Check-in',starts_at:'2026-10-15T06:00:00Z'}],requirements:[{id:'requirement',cohort_id:'cohort',title:'Project brief',due_date:'2026-10-14'}]
}
records.notifications.push(
 {id:'task-notice',cohort_id:'cohort',recipient_id:'intern',title:'Task due',reference_type:'task',reference_id:'task'},
 {id:'requirement-notice',cohort_id:'cohort',recipient_id:'intern',title:'Requirement due',reference_type:'requirement',reference_id:'requirement'},
 {id:'missing-notice',cohort_id:'cohort',recipient_id:'intern',title:'Older update'},
 {id:'unknown-notice',cohort_id:'cohort',recipient_id:'intern',title:'Unknown update',reference_type:'other',reference_id:'other'}
)
let destination,recordId
let noticeRefreshes=0
const client={rpc(name){assert.equal(name,'refresh_due_notifications');noticeRefreshes++;return Promise.resolve({error:null})},from(table){const q={table,op:'read',payload:null,filters:[],select(){return this},eq(k,v){this.filters.push([k,v]);return this},insert(p){this.op='insert';this.payload=p;return this},update(p){this.op='update';this.payload=p;return this},delete(){this.op='delete';return this},then(resolve,reject){let data=records[table].filter(row=>this.filters.every(([k,v])=>row[k]===v));if(this.op==='insert'){const row={id:`new-${records[table].length}`,created_at:'2026-10-13T00:00:00Z',...(table==='blockers'?{status:'open'}:{}),...this.payload};records[table].push(row);data=[row]}if(this.op==='update'){data.forEach(row=>Object.assign(row,this.payload))}if(this.op==='delete')records[table]=records[table].filter(row=>!data.includes(row));return Promise.resolve({data,error:null}).then(resolve,reject)}};return q}}
const navigate=(view,id)=>{destination=view;recordId=id}
const statusTexts=new Set(['To do','In progress','For review','Completed','Pending','Under review','Overdue','Upcoming','Open','Resolved'])
const assertBadges=(min,label)=>{const badges=[...document.querySelectorAll('.status-badge')];assert.ok(badges.length>=min,`${label}: status badges render`);for(const badge of badges){assert.ok(badge.querySelector('svg'),`${label}: badge has an icon`);assert.ok(statusTexts.has(badge.textContent.trim()),`${label}: badge has text (${badge.textContent})`)}}
const render=async(view)=>act(async()=>root.render(React.createElement(InternFlows,{key:view,client,role:'intern',view,userId:'intern',cohortId:'cohort',onChanged(){},onNavigate:navigate})))
await render('projects')
assert.match(document.body.textContent,/Research team/)
assert.match(document.body.textContent,/1\/1 completed/)
assertBadges(1,'Milestones')
assert.match(document.body.textContent,/In progress/)
await act(async()=>root.render(React.createElement(InternFlows,{client,role:'intern',view:'projects',userId:'intern',cohortId:'cohort',focusedRecordId:'project',onChanged(){}})))
assert.ok(document.activeElement.classList.contains('focused-record'),'Dashboard links focus the selected project')
await act(async()=>root.render(React.createElement(InternFlows,{key:'lead-projects',client,role:'lead',view:'projects',userId:'lead',cohortId:'cohort',onChanged(){},onNavigate:navigate})))
const click=async text=>act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent===text).click())
assert.equal(document.querySelectorAll('form').length,0,'Project editors open only after an explicit action')
const formFor=heading=>[...document.querySelectorAll('form')].find(form=>form.querySelector('h4')?.textContent===heading)
await click('Add team')
formFor('Add team').querySelector('[name="name"]').value='Delivery team'
await act(async()=>formFor('Add team').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))
assert.equal(records.teams.at(-1).name,'Delivery team')
await click('Add project')
formFor('Add project').querySelector('[name="title"]').value='Delivery project'
formFor('Add project').querySelector('[name="team_id"]').value=records.teams.at(-1).id
await act(async()=>formFor('Add project').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))
assert.equal(records.projects.at(-1).team_id,records.teams.at(-1).id)
await click('Add sprint')
formFor('Add sprint').querySelector('[name="title"]').value='Sprint 2'
formFor('Add sprint').querySelector('[name="project_id"]').value=records.projects.at(-1).id
formFor('Add sprint').querySelector('[name="sequence"]').value='2'
formFor('Add sprint').querySelector('[name="starts_on"]').value='2026-10-21'
formFor('Add sprint').querySelector('[name="ends_on"]').value='2026-10-28'
await act(async()=>formFor('Add sprint').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))
assert.equal(records.sprints.at(-1).project_id,records.projects.at(-1).id)
await click('Add milestone')
formFor('Add milestone').querySelector('[name="title"]').value='Ship prototype'
formFor('Add milestone').querySelector('[name="sprint_id"]').value=records.sprints.at(-1).id
await act(async()=>formFor('Add milestone').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))
assert.equal(records.milestones.at(-1).project_id,records.projects.at(-1).id)
assert.match(document.body.textContent,/Ship prototype/)
await render('feedback')
assert.match(document.body.textContent,/Good progress/)
assert.match(document.body.textContent,/Test lead/)
await act(async()=>root.render(React.createElement(InternFlows,{key:'lead-feedback',client,role:'lead',view:'feedback',userId:'lead',cohortId:'cohort',onChanged(){},onNavigate:navigate})))
assert.equal(document.querySelector('form'),null,'Feedback editor starts closed')
await click('Post feedback')
assert.match(document.body.textContent,/sprint feedback/)
document.querySelector('[name="body"]').value='Next sprint, validate the prototype'
await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))
assert.equal(records.sprint_feedback.at(-1).body,'Next sprint, validate the prototype')
await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Edit feedback').click())
document.querySelector('[name="body"]').value='Next sprint, test the prototype'
await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))
assert.equal(records.sprint_feedback.at(-1).body,'Next sprint, test the prototype')
await render('blockers')
assert.equal(document.querySelector('form'),null,'Reporting form starts closed')
await click('Report blocker')
assert.ok(document.querySelector('[name="milestone_id"]'),'Interns can link a blocked milestone')
document.querySelector('[name="milestone_id"]').value='milestone'
document.querySelector('[name="description"]').value='Need access to data'
await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))
assert.equal(records.blockers[0].description,'Need access to data')
assert.equal(records.blockers[0].milestone_id,'milestone')
assert.equal(records.blockers[0].project_id,'project')
assert.match(document.body.textContent,/Opened/)
document.querySelector('[name="body"]').value='Asked lead for access'
await act(async()=>document.querySelector('.blocker-discussion form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))
assert.equal(records.blocker_comments[0].body,'Asked lead for access')
await act(async()=>root.render(React.createElement(InternFlows,{key:'lead-blockers',client,role:'lead',view:'blockers',userId:'lead',cohortId:'cohort',onChanged(){},onNavigate:navigate})))
assert.match(document.body.textContent,/Need access to data/)
assertBadges(1,'Blockers')
document.querySelector('[name="body"]').value='Access request sent'
await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))
assert.equal(records.blocker_comments.at(-1).author_id,'lead')
await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Mark resolved').click())
assert.equal(records.blockers[0].status,'resolved')
assert.match(document.body.textContent,/No open blockers/)
await click('Resolved')
await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Reopen').click())
assert.equal(records.blockers[0].status,'open')
await render('notifications')
assert.equal(noticeRefreshes,1)
for(const [label,view,id] of [['Open task','work','task'],['Open requirement','requirements','requirement'],['Open feedback','feedback','feedback']]){await click(label);assert.equal(destination,view);assert.equal(recordId,id)}
assert.equal(records.notifications[0].read_at,null,'Opening a notification retains explicit mark-as-read behavior')
assert.equal(document.querySelectorAll('.flow-card button').length,8,'Missing and unsupported references do not create open actions')
assert.equal(document.body.textContent.match(/Linked item unavailable/g)?.length,2)
assert.match(document.body.textContent,/Unread/)
await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Mark as read').click())
assert.ok(records.notifications[0].read_at)
for(const notice of records.notifications)notice.read_at='2026-10-20T00:00:00Z'
await render('projects');await render('notifications')
assert.match(document.body.textContent,/Read/)
assert.ok(!document.body.textContent.includes('Unread'))
await act(async()=>root.render(React.createElement(InternFlows,{key:'focused-feedback',client,role:'intern',view:'feedback',userId:'intern',cohortId:'cohort',focusedRecordId:'feedback',onChanged(){}})))
assert.ok(document.activeElement.classList.contains('focused-record'),'Notification links focus the selected feedback')
await act(async()=>root.render(React.createElement(InternFlows,{key:'missing-feedback',client,role:'intern',view:'feedback',userId:'intern',cohortId:'cohort',focusedRecordId:'removed-feedback',onChanged(){}})))
assert.match(document.body.textContent,/selected record is unavailable/)
await act(async()=>root.render(React.createElement(Agenda,{client,cohortId:'cohort',revision:0})))
assert.ok(document.body.textContent.indexOf('Project brief')<document.body.textContent.indexOf('Check-in'))
records.events=[{id:'later',cohort_id:'cohort',title:'Midnight next day',starts_at:'2026-10-14T16:00:00+00:00'}];
records.requirements=[{id:'earlier',cohort_id:'cohort',title:'End of previous day',due_date:'2026-10-14'}];
await act(async()=>root.render(React.createElement(Agenda,{client,cohortId:'cohort',revision:99})));
assert.ok(document.body.textContent.indexOf('End of previous day')<document.body.textContent.indexOf('Midnight next day'),'Agenda must sort instants across offsets');
await act(async()=>root.unmount())
console.log('PASS: project progress, feedback, blocker comments, persisted notice state, chronological agenda')
