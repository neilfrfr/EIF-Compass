import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'
mkdirSync('.test-output',{recursive:true});let Calendar
try{for(const [name,ext] of [['GoogleCalendar','tsx'],['motion','ts']])writeFileSync(`.test-output/${name}.js`,ts.transpileModule(readFileSync(`src/${name}.${ext}`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll("'./motion'","'./motion.js'"));Calendar=(await import('../.test-output/GoogleCalendar.js')).default}catch{}
assert.equal(typeof Calendar,'function','Google Calendar component must exist')
const dom=new JSDOM('<div id="root"></div>',{url:'https://compass.test'});Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})
const root=createRoot(document.getElementById('root'));const writes=[]
globalThis.fetch=async(url,options={})=>{if(options.method==='POST'){writes.push(options);return new Response(JSON.stringify({results:[{type:'event',id:'e',status:'created'}]}))}return new Response(JSON.stringify({connected:true,email:'intern@example.com'}))}
const client={auth:{getSession:async()=>({data:{session:{access_token:'user'}}})},from(table){return {select(){return this},eq(){return this},order(){return this},then(resolve){return Promise.resolve({data:table==='events'?[{id:'e',title:'Check-in',starts_at:'2026-10-13T06:00:00Z'}]:[],error:null}).then(resolve)}}}}
await act(async()=>root.render(React.createElement(Calendar,{client,cohortId:'c'})))
const checkbox=document.querySelector('input[type="checkbox"]');assert.ok(checkbox)
await act(async()=>checkbox.click())
await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Review selected').click())
assert.equal(writes.length,0,'Review must not write calendar events')
assert.match(document.body.textContent,/60 minutes/)
await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Confirm sync').click())
assert.equal(writes.length,1);assert.deepEqual(JSON.parse(writes[0].body),{sources:[{type:'event',id:'e'}]})
await act(async()=>root.unmount());console.log('PASS: review before calendar writes and source IDs only')
