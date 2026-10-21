import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import {JSDOM} from 'jsdom'

const dom=new JSDOM('<button class="primary-button">Save</button><button class="text-button">Refresh</button><button class="primary-button danger-button">Remove</button>',{pretendToBeVisual:true})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,Element:dom.window.Element})
let time=1000
Object.defineProperty(globalThis,'performance',{value:{now:()=>time},configurable:true})
const media=new Map()
window.matchMedia=query=>{
  if(!media.has(query)){
    const listeners=new Set()
    media.set(query,{matches:false,addEventListener:(_,cb)=>listeners.add(cb),removeEventListener:(_,cb)=>listeners.delete(cb),change(value){this.matches=value;listeners.forEach(cb=>cb())}})
  }
  return media.get(query)
}
const animations=[]
Element.prototype.animate=function(){
  let finish
  const finished=new Promise(resolve=>finish=resolve)
  const animation={finished,finish,cancel(){finish()}}
  animations.push(animation)
  return animation
}
mkdirSync('.test-output',{recursive:true})
writeFileSync('.test-output/interaction-effects.js',ts.transpileModule(readFileSync('src/interaction-effects.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText)
const {installInteractionEffects}=await import('../.test-output/interaction-effects.js')
const dispose=installInteractionEffects()
const [save,refresh,remove]=document.querySelectorAll('button')
const click=(button,detail=1)=>button.dispatchEvent(new window.MouseEvent('click',{bubbles:true,detail,clientX:100,clientY:80}))
const count=()=>document.querySelectorAll('.action-bubbles').length
click(save,0)
click(refresh)
click(remove)
save.disabled=true;click(save);save.disabled=false
assert.equal(count(),0,'Keyboard, frequent utilities, destructive and disabled actions have no particles')
click(save)
assert.equal(count(),1)
assert.equal(document.querySelectorAll('.action-bubble').length,6)
assert.equal(document.querySelector('.action-bubbles').getAttribute('aria-hidden'),'true')
click(save)
assert.equal(count(),1,'Rapid clicks are throttled')
time+=250;click(save)
time+=250;click(save)
assert.equal(count(),2,'Active bursts have a hard cap')
animations.forEach(animation=>animation.finish())
await new Promise(resolve=>setImmediate(resolve))
assert.equal(count(),0,'Completed particles leave no DOM debris')
media.get('(prefers-reduced-motion: reduce)').change(true)
time+=250;click(save)
assert.equal(count(),0,'Reduced motion suppresses particles')
media.get('(prefers-reduced-motion: reduce)').change(false)
time+=250;click(save)
assert.equal(count(),1)
media.get('(prefers-reduced-motion: reduce)').change(true)
assert.equal(count(),0,'Preference changes cancel active animation immediately')
media.get('(prefers-reduced-motion: reduce)').change(false)
media.get('(forced-colors: active)').change(true)
time+=250;click(save)
assert.equal(count(),0,'Forced colors suppress decorative particles')
media.get('(forced-colors: active)').change(false)
dispose()
time+=250;click(save)
assert.equal(count(),0,'Disposal removes the event listener')
console.log('PASS: pointer-only particles, throttle/cap, animation cleanup, reduced motion, forced colors and disposal')
