import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {JSDOM} from 'jsdom'
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'http://localhost'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true}
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false}
const {createRoot}=await import('react-dom/client')
mkdirSync('.test-output',{recursive:true})
for(const [name,ext] of [['shortcuts','ts'],['CommandPalette','tsx']])writeFileSync(`.test-output/${name}.js`,ts.transpileModule(readFileSync(`src/${name}.${ext}`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText)
const {isTypingTarget,createGoShortcut}=await import('../.test-output/shortcuts.js')
const {default:CommandPalette}=await import('../.test-output/CommandPalette.js')

// isTypingTarget
const el=(html)=>{const d=document.createElement('div');d.innerHTML=html;document.body.append(d);return d.firstElementChild}
for(const html of ['<input>','<textarea></textarea>','<select></select>','<div contenteditable="true"></div>','<div role="dialog"><button>x</button></div>'])assert.equal(isTypingTarget(el(html)),true,html)
assert.equal(isTypingTarget(el('<button>x</button>')),false)
assert.equal(isTypingTarget(null),false)

// go shortcut
const key=(k,target=document.body,init={})=>{const e=new dom.window.KeyboardEvent('keydown',{key:k,bubbles:true,...init});Object.defineProperty(e,'target',{value:target});return e}
const realNow=Date.now
let now=1000;Date.now=()=>now
let went=[]
const handler=createGoShortcut({o:'overview',w:'work'},v=>went.push(v))
handler(key('g'));handler(key('w'));assert.deepEqual(went,['work'],'g then w navigates')
handler(key('w'));assert.deepEqual(went,['work'],'w alone does nothing')
handler(key('g'));now+=1000;handler(key('w'));assert.deepEqual(went,['work'],'too late')
handler(key('g'));handler(key('w',el('<input>')));assert.deepEqual(went,['work'],'typing target ignored')
handler(key('g'));handler(key('w',document.body,{ctrlKey:true}));assert.deepEqual(went,['work'],'ctrl ignored')
handler(key('g'));handler(key('o'));assert.deepEqual(went,['work','overview'])
Date.now=realNow

// palette
const root=createRoot(document.getElementById('root'))
const ran=[]
const items=['Go to Overview','Go to Calendar','Toggle dark mode'].map(label=>({label,run:()=>ran.push(label)}))
const trigger=el('<button>t</button>');trigger.focus()
await act(async()=>root.render(React.createElement(CommandPalette,{items})))
const dialog=document.querySelector('dialog[aria-label="Command palette"]')
assert.ok(dialog&&!dialog.open)
const press=(k,t=document,init={})=>act(async()=>{t.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:k,bubbles:true,...init}))})
const type=async v=>{const input=dialog.querySelector('input');await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,v);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))})}
await press('k',window,{ctrlKey:true})
assert.ok(dialog.open,'Ctrl+K opens')
assert.equal(dialog.querySelectorAll('[role=option]').length,3)
assert.equal(dialog.querySelector('input').getAttribute('aria-activedescendant'),'palette-opt-0')
await type('cal')
assert.equal(dialog.querySelectorAll('[role=option]').length,1)
await press('Enter',dialog.querySelector('input'))
assert.deepEqual(ran,['Go to Calendar']);assert.ok(!dialog.open,'Enter closes')
assert.equal(document.activeElement,trigger,'focus restored')
await act(async()=>{window.dispatchEvent(new dom.window.Event('eif:palette'))})
assert.ok(dialog.open,'eif:palette opens')
await type('zzz')
assert.match(dialog.textContent,/No matches/)
await type('')
await press('ArrowUp',dialog.querySelector('input'))
assert.equal(dialog.querySelector('[aria-selected=true]').textContent,'Toggle dark mode','ArrowUp wraps')
await press('ArrowDown',dialog.querySelector('input'))
assert.equal(dialog.querySelector('[aria-selected=true]').textContent,'Go to Overview','ArrowDown wraps')
await act(async()=>dialog.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})))
assert.ok(!dialog.open,'backdrop click closes')
await act(async()=>{window.dispatchEvent(new dom.window.Event('eif:palette'))})
await act(async()=>dialog.querySelectorAll('[role=option]')[2].click())
assert.deepEqual(ran,['Go to Calendar','Toggle dark mode'],'click runs item');assert.ok(!dialog.open)
await act(async()=>root.unmount())
console.log('PASS: shortcuts and command palette')
