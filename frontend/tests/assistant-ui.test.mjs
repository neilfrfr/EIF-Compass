import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'
mkdirSync('.test-output',{recursive:true})
for(const [name,ext] of [['Assistant','tsx'],['assistant-history','ts']])writeFileSync(`.test-output/${name}.js`,ts.transpileModule(readFileSync(`src/${name}.${ext}`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("import './assistant.css';",'').replaceAll("'./assistant-history'","'./assistant-history.js'"))
const {default:Assistant}=await import('../.test-output/Assistant.js')
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:fn=>fn()})
HTMLElement.prototype.attachEvent=()=>{};HTMLElement.prototype.detachEvent=()=>{}
const root=createRoot(document.getElementById('root')),requests=[],navigated=[]
const client={auth:{getSession:async()=>({data:{session:{access_token:'verified-session'}},error:null})}}
let conversation={id:'c',generation:0,revision:0},turns=[],failLoad=false,failSave=false,failClear=false,role='intern',deferred=null,pageDeferred=null,loadDeferred=null,hasMore=false,streamMode=null,finishStream=null,initialExplanation=undefined
const pair=b=>({requestId:b.requestId,question:b.message||b.question,answer:'<script>bad()</script> Prioritize reflection.',sources:[{id:'task',title:'Reflection',view:'work'}],sourceRefs:[],generatedAt:'2026-10-20T12:00:00Z',truncated:false})
globalThis.fetch=async(url,options)=>{
 const body=options.body?JSON.parse(options.body):{};requests.push({url,method:options.method,body});assert.equal(options.headers.Authorization,'Bearer verified-session')
 if(deferred&&url==='/api/assistant'){const wait=deferred;deferred=null;return wait}
 if(options.method==='GET'&&loadDeferred){const wait=loadDeferred;loadDeferred=null;return wait}
 if(options.method==='GET'&&String(url).includes('?')&&pageDeferred){const wait=pageDeferred;pageDeferred=null;return wait}
 if(options.method==='GET')return Response.json(failLoad?{error:'History unavailable'}:{conversation,turns,has_more:hasMore,next_before:hasMore?2:null},{status:failLoad?503:200})
 if(options.method==='DELETE'){if(failClear)return Response.json({error:'Clear failed'},{status:503});conversation={...conversation,generation:conversation.generation+1,revision:0};turns=[];return Response.json({conversation})}
 const turn=pair(body)
 if(url==='/api/assistant'&&streamMode==='deferred')return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'delta',text:'First live token'})+'\n'));finishStream=()=>{conversation={...conversation,revision:conversation.revision+1};const completeTurn={...turn,answer:'First live token and completed answer'};turns.push(completeTurn);controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'complete',result:{...completeTurn,turn:completeTurn,conversation,historySaved:true}})+'\n'));controller.close()}}}),{headers:{'content-type':'application/x-ndjson'}})
 if(url==='/api/assistant'&&streamMode==='partial')return new Response(JSON.stringify({type:'delta',text:'Partial streamed answer'})+'\n'+JSON.stringify({type:'error',error:'Stream interrupted'})+'\n',{headers:{'content-type':'application/x-ndjson'}})
 if(failSave&&url==='/api/assistant')return Response.json({...turn,historySaved:false,saveError:'history_unavailable'})
 conversation={...conversation,revision:conversation.revision+1};turns=[...turns,turn];if(url==='/api/assistant'&&streamMode==='ok')return new Response(JSON.stringify({type:'delta',text:'Streamed 🌱 answer'})+'\n'+JSON.stringify({type:'complete',result:{...turn,turn,conversation,historySaved:true}})+'\n',{headers:{'content-type':'application/x-ndjson'}});return Response.json({...turn,turn,conversation,historySaved:true})
}
const render=()=>act(async()=>root.render(React.createElement(Assistant,{client,userId:'user-'+role,role,cohortId:'cohort',initialExplanation,onNavigate:(view,recordId)=>navigated.push({view,recordId})})))
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text)
const click=text=>act(async()=>{assert.ok(button(text),`Missing ${text}`);button(text).click()})
const askStarter=async()=>{await click('Plan my day');await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))}
await render();assert.match(document.body.textContent,/Plan my day/)
await click('Plan my day');assert.equal(requests.filter(r=>r.url==='/api/assistant').length,0,'Starter only fills input');assert.match(document.querySelector('textarea').value,/actual deadlines/);assert.equal(document.activeElement,document.querySelector('textarea'))
await askStarter();assert.equal(requests.filter(r=>r.url==='/api/assistant').length,1);assert.ok(!('history' in requests.find(r=>r.url==='/api/assistant').body))
assert.match(document.body.textContent,/Prioritize reflection/);assert.equal(document.querySelectorAll('script').length,0)
await act(async()=>{const options=document.querySelector('.assistant-options');options.open=true;options.querySelector('button').focus();options.querySelector('button').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(options.open,false);assert.equal(document.activeElement,options.querySelector('summary'))})
await click('Reflection');assert.deepEqual(navigated,[{view:'work',recordId:'task'}])
// Remount simulates leaving and returning in a later session.
await act(async()=>root.render(null));await render();assert.match(document.body.textContent,/Prioritize reflection/)
await click('Clear conversation');await click('Cancel');assert.equal(turns.length,1)
failClear=true;await click('Clear conversation');await click('Delete conversation');assert.match(document.body.textContent,/Clear failed/);assert.equal(turns.length,1)
failClear=false;await click('Delete conversation');assert.equal(turns.length,0);assert.ok(!document.body.textContent.includes('Prioritize reflection'))
failSave=true;await askStarter();assert.match(document.body.textContent,/Not saved/);assert.ok(button('Plan my day').disabled)
const count=requests.filter(r=>r.url==='/api/assistant').length
await click('Reload history');assert.match(document.body.textContent,/Not saved/,'Reload must preserve an unsaved pair')
failSave=false;await click('Retry saving');assert.equal(requests.filter(r=>r.url==='/api/assistant').length,count);assert.ok(!document.body.textContent.includes('Not saved'))
// A confirmed clear can cancel a focus reload without leaving loading stuck.
await click('Clear conversation');let resolveLoad;loadDeferred=new Promise(r=>resolveLoad=r);
await act(async()=>window.dispatchEvent(new window.Event('focus')));assert.ok(button('Plan my day').disabled);
const staleLoad={conversation:{...conversation},turns:[...turns],has_more:false,next_before:null};await click('Delete conversation');
await act(async()=>resolveLoad(Response.json(staleLoad)));assert.ok(!button('Plan my day').disabled);assert.equal(turns.length,0);
await askStarter();
// A late older page must not restore a cleared transcript.
hasMore=true;await click('Reload history');let resolvePage;pageDeferred=new Promise(r=>resolvePage=r);await click('Load earlier messages');
const stalePage={conversation:{...conversation},turns:[{...pair({requestId:'old-page',message:'deleted private page'}),sequence:1}],has_more:false,next_before:1};
await click('Clear conversation');await click('Delete conversation');hasMore=false;
await act(async()=>resolvePage(Response.json(stalePage)));assert.ok(!document.body.textContent.includes('deleted private page'));
// A stale unsaved answer can be discarded while preserving newer remote history.
failSave=true;await askStarter();conversation={...conversation,generation:conversation.generation+1,revision:1};turns=[{...pair({requestId:'new-remote',message:'new remote question'}),answer:'New remote answer'}];
await click('Reload history');assert.ok(button('Retry saving').disabled);await click('Discard unsaved answer');assert.equal(turns.length,1);assert.match(document.body.textContent,/New remote answer/);failSave=false;
// Missing migration/network errors block new generation until history recovers.
failLoad=true;await click('Reload history');assert.ok(button('Plan my day').disabled);assert.match(document.body.textContent,/History unavailable/)
failLoad=false;await click('Retry loading history');assert.ok(!button('Plan my day').disabled)
// Streaming keeps partial output visibly incomplete and prevents saving it.
streamMode='deferred';await askStarter();assert.match(document.body.textContent,/First live token/);assert.match(document.body.textContent,/Receiving response/);assert.ok(document.querySelector('.stream-caret[aria-hidden=true]'),'Caret while streaming');assert.match(document.body.textContent,/Generating…/);assert.ok(button('Plan my day').disabled);await act(async()=>finishStream());assert.match(document.body.textContent,/completed answer/);assert.ok(!document.body.textContent.includes('Receiving response'));assert.ok(!document.querySelector('.stream-caret'),'No caret after completion');assert.ok(!document.body.textContent.includes('Generating…'));
streamMode='ok';await askStarter();assert.ok(!document.body.textContent.includes('Receiving response'));
streamMode='partial';const savedCount=turns.length;await askStarter();assert.match(document.body.textContent,/Partial streamed answer/);assert.match(document.body.textContent,/Incomplete answer/);assert.ok(!document.querySelector('.stream-caret'));assert.ok(document.querySelector('.assistant-conversation p[role=status].assistant-incomplete'));assert.equal(turns.length,savedCount);assert.ok(!button('Retry saving'));
await click('Retry loading history');assert.ok(button('Plan my day').disabled);await click('Discard incomplete answer');assert.ok(!button('Plan my day').disabled);streamMode=null;
// In-flight old-scope answer must never appear in a newly selected account/role.
let resolve;deferred=new Promise(r=>resolve=r);await askStarter();role='lead';turns=[];conversation={id:'lead',generation:0,revision:0};await render()
await act(async()=>resolve(Response.json({...pair({requestId:'late',message:'old private question'}),answer:'old private answer',historySaved:true,turn:pair({requestId:'late',message:'old private question'}),conversation})))
assert.ok(!document.body.textContent.includes('old private'));assert.match(document.body.textContent,/Brief my cohort/)
await act(async()=>root.render(null));initialExplanation={question:'Explain selected action',id:'expected',view:'work'};const previousCalls=requests.filter(r=>r.url==='/api/assistant').length;await render();assert.equal(requests.filter(r=>r.url==='/api/assistant').length,previousCalls+1);assert.equal(requests.filter(r=>r.url==='/api/assistant').at(-1).body.expectedAction.id,'expected');await click('Reload history');assert.equal(requests.filter(r=>r.url==='/api/assistant').length,previousCalls+1,'History reload must not repeat explanation')
await act(async()=>root.unmount())
console.log('PASS: restoration, safe text, source navigation, clear confirmation/failure, save-only retry, reload guards and account race isolation')
