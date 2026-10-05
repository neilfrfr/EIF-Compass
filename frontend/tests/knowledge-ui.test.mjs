import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'
mkdirSync('.test-output',{recursive:true})
writeFileSync('.test-output/Knowledge.js',ts.transpileModule(readFileSync('src/Knowledge.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("import './knowledge.css';",''))
const {default:Knowledge}=await import('../.test-output/Knowledge.js')
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,FormData:dom.window.FormData,IS_REACT_ACT_ENVIRONMENT:true})
const root=createRoot(document.getElementById('root'));const writes=[];let denied=false
const fixtures=[{id:'k',title:'Guidelines',content:'Approved content',status:'published',audience:'both',version:3}]
const client={from(){return {op:'read',filters:[],select(){return this},eq(k,v){this.filters.push([k,v]);return this},order(){return this},insert(p){this.op='insert';this.payload=p;return this},update(p){this.op='update';this.payload=p;return this},then(resolve){if(this.op!=='read')writes.push({op:this.op,payload:this.payload,filters:this.filters});return Promise.resolve({data:this.op==='read'?fixtures:denied?[]:[{id:'k'}],error:null}).then(resolve)}}}}
const render=role=>act(async()=>root.render(React.createElement(Knowledge,{client,role,cohortId:'c'})))
const click=text=>act(async()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,`Missing ${text}`);b.click()})
await render('intern');assert.ok(!document.querySelector('form'));assert.ok(!document.body.textContent.includes('Add guidance'))
await render('lead');await click('Add guidance');await click('Save draft');assert.equal(writes.length,0)
document.querySelector('[name="title"]').value='FAQ';document.querySelector('[name="content"]').value='Ask your lead.';await click('Publish guidance');assert.equal(writes.at(-1).payload.status,'published');assert.equal(writes.at(-1).payload.cohort_id,'c')
await click('Edit');denied=true;await click('Save draft');assert.ok(document.querySelector('form'));assert.match(document.querySelector('[role="alert"]').textContent,/changed|permissions/);assert.ok(writes.at(-1).filters.some(([k,v])=>k==='version'&&v===3))
await click('Cancel');denied=false;await click('Unpublish');assert.equal(writes.at(-1).payload.status,'draft')
await act(async()=>root.unmount());console.log('PASS: lead-only editor, validation, publication, conflict retention and unpublishing')
