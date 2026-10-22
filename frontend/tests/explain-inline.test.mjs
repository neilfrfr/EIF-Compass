import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'
mkdirSync('.test-output',{recursive:true})
for(const [name,ext] of [['ExplainInline','tsx'],['assistant-history','ts']])writeFileSync(`.test-output/${name}.js`,ts.transpileModule(readFileSync(`src/${name}.${ext}`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll("'./assistant-history'","'./assistant-history.js'"))
const {default:ExplainInline,explainQuestion}=await import('../.test-output/ExplainInline.js')
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})
const errors=[],consoleError=console.error;console.error=(...args)=>{errors.push(args.join(' '));consoleError(...args)}

// (e) The question text is unchanged from App.tsx.
assert.equal(explainQuestion({title:'X'}),'Explain why “X” is my next recommended action, using its recorded reason and deadline. Give a practical first step.')

const client={auth:{getSession:async()=>({data:{session:{access_token:'tok'}},error:null})}}
const action={id:'t1',title:'Write summary',view:'work',reason:'Due soon',date:null,dueAt:null,exact:false}
const encoder=new TextEncoder(),line=event=>encoder.encode(JSON.stringify(event)+'\n')
let requests=[],stream,failGet=false,saveConflict=false
globalThis.fetch=async(url,options)=>{
 const body=options.body?JSON.parse(options.body):undefined;requests.push({url,method:options.method,body,signal:options.signal})
 assert.equal(options.headers.Authorization,'Bearer tok')
 if(url==='/api/assistant/history'&&options.method==='GET'&&failGet)return Response.json({error:'History unavailable'},{status:503})
 if(url==='/api/assistant/history'&&options.method==='POST'&&saveConflict)return Response.json({error:'Your history changed in another tab.',code:'revision_conflict'},{status:409})
 if(url==='/api/assistant/history'&&options.method==='GET')return Response.json({conversation:{id:'conv',generation:2,revision:5},turns:[],has_more:false,next_before:null})
 if(url==='/api/assistant/history')return Response.json({conversation:{id:'conv',generation:2,revision:6},turn:{requestId:body.requestId,question:body.question,answer:body.answer}})
 return new Response(new ReadableStream({start(controller){stream=controller}}),{headers:{'content-type':'application/x-ndjson'}})
}
const flush=()=>act(async()=>{for(let i=0;i<8;i++)await new Promise(r=>setTimeout(r,0))})
const root=createRoot(document.getElementById('root'))
let opened=0,continued=0
const render=(userId='u')=>act(async()=>root.render(React.createElement(ExplainInline,{client,userId,role:'intern',cohortId:'c',action,question:explainQuestion(action),onOpenAssistant:()=>opened++,onContinue:()=>continued++})))
const reset=async()=>{await act(async()=>root.render(null));requests=[];stream=undefined}
const text=()=>document.body.textContent
const button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent===label)
const posted=()=>requests.find(r=>r.url==='/api/assistant')
const complete=(answer,historySaved,saveError='history_unavailable')=>({type:'complete',result:{requestId:posted().body.requestId,answer,generatedAt:'2026-10-20T12:00:00Z',truncated:false,sourceRefs:[],sources:[],historySaved,...(historySaved?{turn:{requestId:posted().body.requestId,answer},conversation:{id:'conv',generation:2,revision:6}}:{saveError})}})

// (a) Saved: history first, then the Assistant's explain body; deltas stream with "Generating…".
await render();await flush()
assert.deepEqual(requests.map(r=>`${r.method} ${r.url}`),['GET /api/assistant/history','POST /api/assistant'])
const body=posted().body
assert.equal(typeof body.requestId,'string')
assert.deepEqual(body,{message:explainQuestion(action),intent:'explain_next_action',expectedAction:{id:'t1',view:'work'},stream:true,conversationId:'conv',requestId:body.requestId,generation:2,revision:5})
await act(async()=>stream.enqueue(line({type:'delta',text:'One '})));await flush()
assert.match(text(),/Generating…/);assert.match(text(),/One/)
const region=document.querySelector('[aria-live="polite"]');assert.ok(region);assert.equal(region.getAttribute('aria-busy'),'true')
assert.equal(document.querySelector('.explain-caret')?.getAttribute('aria-hidden'),'true')
await act(async()=>{stream.enqueue(line({type:'delta',text:'two '}));stream.enqueue(line({type:'delta',text:'three'}))});await flush()
assert.match(text(),/One two three/)
await act(async()=>{stream.enqueue(line(complete('One two three.',true)));stream.close()});await flush()
assert.match(text(),/One two three\./);assert.match(text(),/Saved to your assistant history/);assert.ok(!text().includes('Generating…'))
assert.equal(region.getAttribute('aria-busy'),'false')
await act(async()=>button('Continue in assistant').click());assert.equal(continued,1)

// (b) Not saved: Retry saving reuses the streamed requestId, with no new AI request.
await reset();await render();await flush()
await act(async()=>{stream.enqueue(line({type:'delta',text:'Answer'}));stream.enqueue(line(complete('Answer',false)));stream.close()});await flush()
assert.ok(button('Retry saving'));assert.ok(!text().includes('Saved to your assistant history'))
const streamedId=posted().body.requestId
await act(async()=>button('Retry saving').click());await flush()
const retry=requests.find(r=>r.url==='/api/assistant/history'&&r.method==='POST')
assert.deepEqual(retry.body,{conversationId:'conv',requestId:streamedId,generation:2,revision:5,question:explainQuestion(action),answer:'Answer',generatedAt:'2026-10-20T12:00:00Z',truncated:false,sourceRefs:[]})
assert.equal(requests.filter(r=>r.url==='/api/assistant').length,1)
assert.match(text(),/Saved to your assistant history/);assert.ok(!button('Retry saving'))

// (c) Interrupted: partial text stays, labelled incomplete, with the fallback action.
await reset();await render();await flush()
await act(async()=>stream.enqueue(line({type:'delta',text:'Partial words'})));await flush()
await act(async()=>stream.error(new TypeError('Network connection lost')));await flush()
assert.match(text(),/Partial words/);assert.match(text(),/Incomplete — not saved/);assert.match(text(),/Network connection lost/);assert.ok(!text().includes('Generating…'))
await act(async()=>button('Open in assistant').click());assert.equal(opened,1)

// (g) A generation conflict cannot be retried: hand over to the Assistant instead.
await reset();await render();await flush()
await act(async()=>{stream.enqueue(line(complete('Conflicted',false,'generation_conflict')));stream.close()});await flush()
assert.ok(!button('Retry saving'),'no retry on a generation conflict');assert.ok(button('Open in assistant'));assert.ok(document.querySelector('[role="alert"]'))
await act(async()=>button('Open in assistant').click());assert.equal(opened,2)

// (g2) A revision conflict is handled the same way.
await reset();await render();await flush()
await act(async()=>{stream.enqueue(line(complete('Conflicted',false,'revision_conflict')));stream.close()});await flush()
assert.ok(!button('Retry saving'),'no retry on a revision conflict');assert.ok(button('Open in assistant'));assert.ok(document.querySelector('[role="alert"]'))

// (h) A retry that hits a 409 conflict hides Retry afterwards.
await reset();await render();await flush()
await act(async()=>{stream.enqueue(line(complete('Answer',false)));stream.close()});await flush()
saveConflict=true;await act(async()=>button('Retry saving').click());await flush();saveConflict=false
assert.ok(!button('Retry saving'),'retry hidden after a conflict');assert.ok(button('Open in assistant'));assert.match(document.querySelector('[role="alert"]').textContent,/cannot be saved/)

// (i) A failed history load fails without asking the AI.
await reset();failGet=true;await render();await flush();failGet=false
assert.match(text(),/Incomplete — not saved/);assert.match(text(),/History unavailable/);assert.ok(button('Open in assistant'))
assert.equal(requests.filter(r=>r.url==='/api/assistant').length,0)

// (d) Unmount mid-stream aborts the request and ignores late deltas.
await reset();await render();await flush()
await act(async()=>stream.enqueue(line({type:'delta',text:'Early'})));await flush()
const signal=posted().signal
await act(async()=>root.render(null))
assert.equal(signal.aborted,true)
await act(async()=>{try{stream.enqueue(line({type:'delta',text:'Late'}))}catch{}});await flush()
assert.ok(!text().includes('Late'))

// (f) Changing account mid-stream aborts the old request and starts a fresh one.
requests=[];await render('u');await flush()
const first=posted().signal
await render('u2');await flush()
assert.equal(first.aborted,true)
assert.equal(requests.filter(r=>r.url==='/api/assistant').length,2)
await act(async()=>root.unmount())

assert.deepEqual(errors,[],'no React warnings')
console.log('PASS: inline explanation streams, saves, retries, falls back and aborts')
