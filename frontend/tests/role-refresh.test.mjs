import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'
mkdirSync('.test-output',{recursive:true})
for(const name of ['App','AuthGate','WorkManager','data']){
let content=ts.transpileModule(readFileSync(`src/${name}.${name==='data'?'ts':'tsx'}`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
content=content.replaceAll("'./lib/supabase'","'./test-client.js'")
for(const dep of ['AuthGate','WorkManager','data'])content=content.replaceAll(`'./${dep}'`,`'./${dep}.js'`)
writeFileSync(`.test-output/${name}.js`,content)
}
let role='intern',fail=false
const client={from(){return {select(){return this},eq(){return this},or(){return this},order(){return this},maybeSingle(){return Promise.resolve(fail?{data:null,error:new Error('Profile unavailable')}:{data:{display_name:'Test User',role,cohort_id:'cohort'},error:null})},then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}}}}
globalThis.__testClient=client
writeFileSync('.test-output/test-client.js','export const supabase = globalThis.__testClient;')
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,FormData:dom.window.FormData,IS_REACT_ACT_ENVIRONMENT:true})
const {Workspace}=await import('../.test-output/App.js')
const root=createRoot(document.getElementById('root'))
const session={user:{id:'test-user'}}
await act(async()=>root.render(React.createElement(Workspace,{session})))
assert.match(document.body.textContent,/YOUR FELLOWSHIP JOURNEY/)
role='lead'
await act(async()=>window.dispatchEvent(new window.Event('focus')))
assert.match(document.body.textContent,/SAMPLE COHORT PULSE/,'Role must refresh from database on window focus')
fail=true
await act(async()=>window.dispatchEvent(new window.Event('focus')))
assert.ok(!document.body.textContent.includes('YOUR FELLOWSHIP JOURNEY'),'Profile failures must not fall back to intern')
assert.match(document.body.textContent,/Profile unavailable/)
await act(async()=>root.unmount())
console.log('PASS: profile role refresh and no intern fallback on profile errors')
