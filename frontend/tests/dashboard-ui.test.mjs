import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'
mkdirSync('.test-output',{recursive:true})
for(const name of ['Dashboard','dashboard']){
const source=readFileSync(`src/${name}.${name==='Dashboard'?'tsx':'ts'}`,'utf8')
writeFileSync(`.test-output/${name}.js`,ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll("'./dashboard'","'./dashboard.js'"))
}
const {default:Dashboard}=await import('../.test-output/Dashboard.js')
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true})
const rows={cohorts:{id:'c',name:'Database cohort',starts_on:'2026-09-30',ends_on:'2026-11-24'},profiles:[{id:'a',display_name:'Database Intern A',role:'intern',team_name:'Research'},{id:'b',display_name:'Database Intern B',role:'intern',team_name:'Research'}],tasks:[{id:'t1',title:'A private task',assignee_id:'a',status:'completed',due_date:'2026-10-07'},{id:'t2',title:'B private task',assignee_id:'b',status:'to_do',due_date:'2026-10-04'}],requirements:[{id:'r',title:'Actual reflection',status:'pending',assignee_id:null,due_date:'2026-10-04'}],requirement_submissions:[{requirement_id:'r',user_id:'a',status:'in_review',submission_url:'https://example.com'}],events:[{id:'e',title:'Actual future event',starts_at:'2099-10-07T14:00:00+08:00'}]}
const client={from(table){return {select(){return this},eq(){return this},maybeSingle(){return Promise.resolve({data:rows[table],error:null})},then(resolve,reject){return Promise.resolve({data:rows[table],error:null}).then(resolve,reject)}}}}
const root=createRoot(document.getElementById('root'))
let destination
const render=async(role)=>act(async()=>root.render(React.createElement(Dashboard,{client,role,userId:'a',cohortId:'c',revision:0,onNavigate(view){destination=view}})))
await render('lead')
assert.ok(document.querySelector('.lead-dashboard'))
assert.match(document.body.textContent,/Database cohort/)
assert.match(document.body.textContent,/Database Intern B/)
assert.match(document.body.textContent,/Actual reflection/)
assert.ok(!document.body.textContent.includes('20 fellows'))
await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='View').click())
assert.match(document.querySelector('.intern-detail').textContent,/A private task/)
await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Review all →').click())
assert.equal(destination,'requirements')
await render('intern')
assert.ok(document.querySelector('.intern-dashboard'))
assert.match(document.body.textContent,/A private task/)
assert.ok(!document.body.textContent.includes('B private task'))
assert.ok(!document.body.textContent.includes('Database Intern B'))
assert.match(document.body.textContent,/In review/)
assert.match(document.body.textContent,/Actual future event/)
await act(async()=>root.unmount())
console.log('PASS: database-backed role layouts, intern isolation, review queue, drill-down and navigation')
