import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'
mkdirSync('.test-output',{recursive:true})
let Bin
try{for(const name of ['SubmissionBin','submissions'])writeFileSync(`.test-output/${name}.js`,ts.transpileModule(readFileSync(`src/${name}.${name==='SubmissionBin'?'tsx':'ts'}`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll("'./submissions'","'./submissions.js'"));Bin=(await import('../.test-output/SubmissionBin.js')).default}catch{}
assert.equal(typeof Bin,'function','Submission bin component must exist')
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})
const root=createRoot(document.getElementById('root'))
const client={from(){return{select(){return this},eq(){return this},order(){return this},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}}}}
await act(async()=>root.render(React.createElement(Bin,{client,role:'intern',userId:'u',requirement:{id:'r',due_date:'2000-01-01'},submission:{requirement_id:'r',user_id:'u',status:'in_review',submission_url:'https://docs.google.com/document/d/test'},onChanged(){}})))
assert.match(document.body.textContent,/locked/i)
assert.ok(![...document.querySelectorAll('button')].some(b=>/Unsubmit|Submit for review/.test(b.textContent)))
assert.equal(document.querySelector('a').href,'https://docs.google.com/document/d/test')
await act(async()=>root.render(React.createElement(Bin,{client,role:'lead',userId:'lead',requirement:{id:'r',due_date:'2099-01-01'},submission:{requirement_id:'r',user_id:'u',status:'completed'},onChanged(){}})))
assert.ok([...document.querySelectorAll('button')].some(b=>b.textContent==='Request changes'),'Lead must be able to reopen approved work')
await act(async()=>root.unmount());console.log('PASS: legacy link display and no editing actions after cutoff')
