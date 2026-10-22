import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {JSDOM} from 'jsdom'
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
let reduce=false,frames=[]
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})
window.matchMedia=q=>({matches:q.includes('reduce')&&reduce})
window.requestAnimationFrame=cb=>frames.push(cb)
window.cancelAnimationFrame=()=>{}
const runFrame=now=>{const queue=frames;frames=[];queue.forEach(cb=>cb(now))}
const {createRoot}=await import('react-dom/client')
mkdirSync('.test-output',{recursive:true})
writeFileSync('.test-output/motion.js',ts.transpileModule(readFileSync('src/motion.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText)
const {useCountUp,usePageTransition,reducedMotion,useCompletionFlash,useRowGlide}=await import('../.test-output/motion.js')

let seen
function Count({target}){seen=useCountUp(target);return null}
function Page({k}){seen=usePageTransition(k);return null}
const root=createRoot(document.getElementById('root'))

reduce=true
assert.equal(reducedMotion(),true)
await act(async()=>root.render(React.createElement(Count,{target:50})))
assert.equal(seen,50,'reduced motion shows the final value on first render')
await act(async()=>root.render(React.createElement(Count,{target:null})))
assert.equal(seen,null)
await act(async()=>root.unmount())

reduce=false
let r2=createRoot(document.getElementById('root'))
await act(async()=>r2.render(React.createElement(Count,{target:50})))
assert.ok(seen<50,'counts up from below the target')
await act(async()=>runFrame(1000))
await act(async()=>runFrame(1500))
assert.ok(seen>0&&seen<50,'mid-way value')
await act(async()=>runFrame(2200))
assert.equal(seen,50,'reaches the target after the duration')
assert.equal(frames.length,0,'stops requesting frames when done')
await act(async()=>r2.render(React.createElement(Count,{target:50})))
assert.equal(seen,50,'same target does not restart')
assert.equal(frames.length,0)
await act(async()=>r2.unmount())

const realTimeout=globalThis.setTimeout
r2=createRoot(document.getElementById('root'))
await act(async()=>r2.render(React.createElement(Page,{k:'overview'})))
assert.equal(seen.className,'page-entering')
assert.equal(seen.key,'overview')
await act(async()=>r2.render(React.createElement(Page,{k:'work'})))
assert.equal(seen.className,'page-leaving','old page lifts away first')
assert.equal(seen.key,'overview','old content stays while leaving')
await act(async()=>new Promise(r=>realTimeout(r,200)))
assert.equal(seen.className,'page-entering','new page rises in after 160ms')
assert.equal(seen.key,'work')
await act(async()=>new Promise(r=>realTimeout(r,1250)))
assert.equal(seen.className,'','arrival class clears after the entry window so refreshes never replay it')
await act(async()=>r2.render(React.createElement(Page,{k:'calendar'})))
await act(async()=>r2.render(React.createElement(Page,{k:'work'})))
assert.equal(seen.className,'page-leaving')
await act(async()=>new Promise(r=>realTimeout(r,200)))
assert.deepEqual(seen,{key:'work',className:'page-entering'},'A->B->A settles on A')
await act(async()=>r2.render(React.createElement(Page,{k:'projects'})))
await act(async()=>r2.render(React.createElement(Page,{k:'feedback'})))
await act(async()=>new Promise(r=>realTimeout(r,200)))
assert.deepEqual(seen,{key:'feedback',className:'page-entering'},'A->B->C settles on C')
await act(async()=>new Promise(r=>realTimeout(r,1250)))
assert.equal(seen.className,'')
reduce=true
await act(async()=>r2.render(React.createElement(Page,{k:'calendar'})))
assert.equal(seen.className,'','reduced motion: no transition class')
assert.equal(seen.key,'calendar','reduced motion: instant switch')
await act(async()=>r2.unmount())

reduce=false
let flashApi
function Flash(){flashApi=useCompletionFlash();return null}
r2=createRoot(document.getElementById('root'))
await act(async()=>r2.render(React.createElement(Flash)))
assert.equal(flashApi.isFlashing('t1'),false)
await act(async()=>flashApi.flash('t1'))
assert.equal(flashApi.isFlashing('t1'),true,'flashing right after flash()')
assert.equal(flashApi.isFlashing('t2'),false)
await act(async()=>new Promise(r=>realTimeout(r,650)))
assert.equal(flashApi.isFlashing('t1'),false,'flash ends after 600ms')
await act(async()=>r2.unmount())

// useRowGlide: one aria-hidden glide per list, follows the hovered row, hides on leave, absent under reduced motion
function Glide(){const ref=React.useRef(null);useRowGlide(ref,'.row');return React.createElement('div',{ref,className:'list'},React.createElement('div',{className:'row'},'A'),React.createElement('div',{className:'row'},'B'))}
r2=createRoot(document.getElementById('root'))
await act(async()=>r2.render(React.createElement(Glide)))
const list=document.querySelector('.list'),glide=list.querySelector('.row-glide')
assert.ok(glide&&glide.getAttribute('aria-hidden')==='true','one aria-hidden glide')
await act(async()=>r2.render(React.createElement(Glide)))
assert.equal(list.querySelectorAll('.row-glide').length,1,'re-render does not duplicate the glide')
list.querySelectorAll('.row')[1].dispatchEvent(new window.Event('pointerover',{bubbles:true}))
assert.equal(glide.style.opacity,'1','glide shows on a row')
list.dispatchEvent(new window.Event('pointerleave'))
assert.equal(glide.style.opacity,'0','glide hides on leave')
await act(async()=>r2.unmount())
reduce=true
r2=createRoot(document.getElementById('root'))
await act(async()=>r2.render(React.createElement(Glide)))
assert.equal(document.querySelector('.row-glide'),null,'no glide under reduced motion')
await act(async()=>r2.unmount())
console.log('PASS: motion hooks')
