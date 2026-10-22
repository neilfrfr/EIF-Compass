import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {JSDOM} from 'jsdom'
const dom=new JSDOM('<!doctype html><html><head><meta name="theme-color" content="#245862"></head><body><div id="root"></div></body></html>',{url:'http://localhost'})
let dark=true
const store=new Map()
let storageThrows=false
const localStorage={getItem:k=>{if(storageThrows)throw new Error('denied');return store.has(k)?store.get(k):null},setItem:(k,v)=>{if(storageThrows)throw new Error('denied');store.set(k,String(v))}}
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,MutationObserver:dom.window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true,localStorage,matchMedia:q=>({matches:q.includes('dark')?dark:false})})
window.addEventListener=window.addEventListener.bind(window)
const {createRoot}=await import('react-dom/client')
mkdirSync('.test-output',{recursive:true})
for(const [name,ext] of [['theme','ts'],['ThemeToggle','tsx']])writeFileSync(`.test-output/${name}.js`,ts.transpileModule(readFileSync(`src/${name}.${ext}`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll("'./theme'","'./theme.js'"))
const {readTheme,setTheme}=await import('../.test-output/theme.js')
const {default:ThemeToggle}=await import('../.test-output/ThemeToggle.js')
const html=document.documentElement
assert.equal(readTheme(),'dark','empty storage follows OS dark')
store.set('eif-theme','blue');assert.equal(readTheme(),'dark','junk value falls back to OS')
dark=false;assert.equal(readTheme(),'light','junk value, OS light')
dark=true;store.clear();storageThrows=true
assert.equal(readTheme(),'dark','throwing storage falls back to OS')
assert.doesNotThrow(()=>setTheme('light'),'setTheme swallows storage errors')
assert.equal(html.dataset.theme,'light')
storageThrows=false
setTheme('dark')
assert.equal(html.dataset.theme,'dark');assert.equal(store.get('eif-theme'),'dark');assert.equal(html.style.colorScheme,'dark')
assert.equal(document.querySelector('meta[name=theme-color]').content,'#061416')
store.set('eif-theme','light');assert.equal(readTheme(),'light','valid stored value wins over OS')
const root=createRoot(document.getElementById('root'))
await act(async()=>root.render(React.createElement(ThemeToggle)))
const btn=document.querySelector('button[aria-label="Dark mode"]')
assert.ok(btn)
assert.equal(btn.getAttribute('aria-pressed'),'true')
await act(async()=>btn.click())
assert.equal(btn.getAttribute('aria-pressed'),'false');assert.equal(html.dataset.theme,'light')
await act(async()=>btn.click())
assert.equal(btn.getAttribute('aria-pressed'),'true');assert.equal(html.dataset.theme,'dark')
await act(async()=>root.unmount())
const index=readFileSync('index.html','utf8')
assert.match(index,/eif-theme/);assert.doesNotMatch(index,/manrope/i)
console.log('PASS: theme read/apply/persist, storage failures, toggle and index.html no-flash script')
