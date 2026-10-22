import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'
mkdirSync('.test-output',{recursive:true})
const modules=['Dashboard','dashboard-model','StatusBadge','ExplainInline','assistant-history','motion']
for(const name of modules){
const source=readFileSync(`src/${name}.${['Dashboard','StatusBadge','ExplainInline'].includes(name)?'tsx':'ts'}`,'utf8')
let out=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
for(const dep of modules)out=out.replaceAll(`'./${dep}'`,`'./${dep}.js'`)
writeFileSync(`.test-output/${name}.js`,out)
}
const {default:Dashboard}=await import('../.test-output/Dashboard.js')
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true})
// Reduced motion: count-ups must show their final values on first paint.
window.matchMedia=query=>({matches:query.includes('reduce')});window.requestAnimationFrame=()=>0;window.cancelAnimationFrame=()=>{}
const badgesOk=()=>{const badges=[...document.querySelectorAll('.status-badge')];assert.ok(badges.length>0,'status badges render');for(const b of badges){assert.ok(b.textContent.trim(),'badge has text');assert.equal(b.querySelector('svg')?.getAttribute('aria-hidden'),'true','badge has an aria-hidden icon')}}
const rows={cohorts:{id:'c',name:'Database cohort',starts_on:'2026-09-30',ends_on:'2026-11-24'},profiles:[{id:'a',display_name:'Database Intern A',role:'intern',team_name:null},{id:'b',display_name:'Database Intern B',role:'intern',team_name:null}],tasks:[{id:'t1',title:'A private task',assignee_id:'a',status:'completed',due_date:'2026-10-07'},{id:'t2',title:'B private task',assignee_id:'b',status:'to_do',due_date:'2026-10-04'}],requirements:[{id:'r',title:'Actual reflection',status:'pending',assignee_id:null,due_date:'2026-10-04'}],requirement_submissions:[{requirement_id:'r',user_id:'a',status:'in_review',submission_url:'https://example.com'}],events:[{id:'e',title:'Actual future event',starts_at:'2099-10-07T14:00:00+08:00'}],blockers:[{id:'block',reporter_id:'b',project_id:'project',status:'open',description:'Missing access'}],milestones:[],projects:[{id:'project',title:'Team research',team_id:'team'}],teams:[{id:'team',name:'Research'}],team_memberships:[{team_id:'team',user_id:'a'},{team_id:'team',user_id:'b'}]}
const client={from(table){return {select(){return this},eq(){return this},maybeSingle(){return Promise.resolve({data:rows[table],error:null})},then(resolve,reject){return Promise.resolve({data:rows[table],error:null}).then(resolve,reject)}}}}
const root=createRoot(document.getElementById('root'))
let destination,recordId
const render=async(role,revision=0)=>act(async()=>root.render(React.createElement(Dashboard,{client,role,userId:'a',cohortId:'c',revision,onNavigate(view,id){destination=view;recordId=id}})))
await render('lead')
assert.ok(document.querySelector('.lead-dashboard'))
assert.match(document.body.textContent,/Database cohort/)
assert.match(document.body.textContent,/Database Intern B/)
assert.match(document.body.textContent,/Research/)
assert.match(document.body.textContent,/Actual reflection/)
assert.match(document.body.textContent,/Open blockers/)
assert.match(document.body.textContent,/Missing access/)
assert.match(document.body.textContent,/Overdue items/)
badgesOk();assert.ok(!document.querySelector('.dashboard-panel .dashboard-badge'),'statuses use StatusBadge, not bare badges')
assert.equal(document.querySelectorAll('.dashboard-metrics strong')[0].textContent,'2','metric shows its final value under reduced motion')
await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='View team').click())
assert.match(document.querySelector('.intern-detail').textContent,/Database Intern B/)
assert.ok(!document.body.textContent.includes('20 fellows'))
await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='View').click())
assert.match(document.querySelectorAll('.intern-detail')[1].textContent,/A private task/)
await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Review all →').click())
assert.equal(destination,'requirements')
await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Open blockers →').click())
assert.equal(destination,'blockers')
rows.blockers[0].status='resolved'
await render('lead',1)
assert.match(document.body.textContent,/No open blockers/)
await render('intern')
assert.ok(document.querySelector('.intern-dashboard'));assert.match(document.body.textContent,/Hello, Database Intern A/);assert.match(document.body.textContent,/No current or upcoming milestone/)
assert.match(document.body.textContent,/A private task/)
assert.ok(!document.body.textContent.includes('B private task'))
assert.ok(!document.body.textContent.includes('Database Intern B'))
assert.match(document.body.textContent,/Under review/)
badgesOk();assert.ok(document.querySelector('.status-badge.is-in_review'))
assert.equal(document.querySelectorAll('.dashboard-metrics strong')[1].textContent,'0/1')
assert.match(document.body.textContent,/Actual future event/)
rows.tasks.push({id:'explain',title:'Write summary',assignee_id:'a',status:'to_do',due_date:'2099-10-20'})
let explained
await render('intern',3)
await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Open task').click())
assert.equal(destination,'work');assert.equal(recordId,'explain')
await act(async()=>root.render(React.createElement(Dashboard,{client,role:'intern',userId:'a',cohortId:'c',revision:3,onNavigate(view){destination=view},onOpenAssistant(action){explained=action}})))
assert.match(document.querySelector('.dashboard-next-action').textContent,/Suggested next step/)
assert.ok(!document.querySelector('.explain-inline'))
globalThis.fetch=()=>new Promise(()=>{})
client.auth={getSession:async()=>({data:{session:{access_token:'t'}},error:null})}
await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Explain this').click())
assert.ok(document.querySelector('.dashboard-next-action .explain-inline'),'explanation mounts inside the card')
await act(async()=>root.unmount())
console.log('PASS: database-backed role layouts, intern isolation, review queue, drill-down and navigation')
