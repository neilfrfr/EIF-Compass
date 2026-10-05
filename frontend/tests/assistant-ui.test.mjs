import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'
mkdirSync('.test-output',{recursive:true})
writeFileSync('.test-output/Assistant.js',ts.transpileModule(readFileSync('src/Assistant.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("import './assistant.css';",''))
const {default:Assistant}=await import('../.test-output/Assistant.js')
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})
const root=createRoot(document.getElementById('root'))
const navigated=[],requests=[];let fail=false
const client={auth:{getSession:async()=>({data:{session:{access_token:'verified-session'}},error:null})}}
globalThis.fetch=async(url,options)=>{requests.push(JSON.parse(options.body));assert.equal(options.headers.Authorization,'Bearer verified-session');return new Response(JSON.stringify(fail?{error:'Provider unavailable'}:{answer:'<script>bad()</script> Prioritize reflection.',sources:[{id:'task',title:'Reflection',view:'work'}],generatedAt:'2026-10-05T12:00:00Z',truncated:false}),{status:fail?503:200})}
const render=role=>act(async()=>root.render(React.createElement(Assistant,{client,role,cohortId:'cohort',onNavigate:v=>navigated.push(v)})))
const click=text=>act(async()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,`Missing ${text}`);b.click()})
await render('intern');assert.match(document.body.textContent,/Plan my day/);assert.ok(!document.body.textContent.includes('Draft cohort email'))
await click('Plan my day');assert.equal(requests.length,1);assert.equal(requests[0].history.length,0)
assert.match(document.body.textContent,/Prioritize reflection/);assert.equal(document.querySelectorAll('script').length,0)
await click('Reflection');assert.deepEqual(navigated,['work'])
await render('lead');assert.match(document.body.textContent,/Brief my cohort/);assert.match(document.body.textContent,/Draft cohort email/)
fail=true;await click('Brief my cohort');assert.match(document.querySelector('[role="alert"]').textContent,/Provider unavailable/)
assert.ok(!document.querySelector('button[type="submit"]').disabled)
await click('Clear conversation');assert.ok(!document.body.textContent.includes('Prioritize reflection'))
await act(async()=>root.unmount())
console.log('PASS: role entry points, authenticated requests, source navigation, safe text, error recovery and reset')
