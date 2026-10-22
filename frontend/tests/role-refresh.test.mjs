import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'
mkdirSync('.test-output',{recursive:true})
for(const name of ['assistant-history','Assistant','App','AuthGate','WorkManager','Dashboard','dashboard-model','data','SubmissionBin','submissions','GoogleCalendar','Agenda','InternFlows','DetailDrawer','motion','theme','ThemeToggle','CompassLogo','CommandPalette','shortcuts','StatusBadge','ExplainInline']){
let content=ts.transpileModule(readFileSync(`src/${name}.${['assistant-history','data','dashboard-model','submissions','motion','theme','shortcuts'].includes(name)?'ts':'tsx'}`,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
content=content.replace("import './assistant.css';",'').replace("import './auth.css';",'')
content=content.replaceAll("'./lib/supabase'","'./test-client.js'")
for(const dep of ['assistant-history','Assistant','AuthGate','WorkManager','Dashboard','dashboard-model','data','SubmissionBin','submissions','GoogleCalendar','Agenda','InternFlows','DetailDrawer','motion','theme','ThemeToggle','CompassLogo','CommandPalette','shortcuts','StatusBadge','ExplainInline'])content=content.replaceAll(`'./${dep}'`,`'./${dep}.js'`)
writeFileSync(`.test-output/${name}.js`,content)
}
let role='intern',fail=false,signOuts=0
const client={auth:{async signOut(){signOuts++;return {error:null}}},from(){return {select(){return this},eq(){return this},or(){return this},order(){return this},maybeSingle(){return Promise.resolve(fail?{data:null,error:new Error('Profile unavailable')}:{data:{display_name:'Test User',role,cohort_id:'cohort'},error:null})},then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}}}}
globalThis.__testClient=client
writeFileSync('.test-output/test-client.js','export const supabase = globalThis.__testClient;')
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,MutationObserver:dom.window.MutationObserver,FormData:dom.window.FormData,IS_REACT_ACT_ENVIRONMENT:true})
// Each frame advances a second, so count-ups finish in a few synchronous frames instead of producing NaN.
let frameTime=0
window.requestAnimationFrame=callback=>{callback(frameTime+=1000);return 0}
window.cancelAnimationFrame=()=>{}
window.scrollTo=()=>{}
const navigationAnimations=[]
window.matchMedia=()=>({matches:false})
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true}
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false}
dom.window.HTMLElement.prototype.animate=function(frames,options){
 let finish,cancel
 const finished=new Promise((resolve,reject)=>{finish=resolve;cancel=()=>reject(new Error('Cancelled'))})
 const animation={finished,finish,cancel,frames,options}
 navigationAnimations.push(animation)
 return animation
}
const {Workspace}=await import('../.test-output/App.js')
const root=createRoot(document.getElementById('root'))
const session={user:{id:'test-user'}}
await act(async()=>root.render(React.createElement(Workspace,{session})))
assert.match(document.body.textContent,/Hello, EIF Fellow/)
const navDialog=document.querySelector('.mobile-navigation')
const pointerClick=element=>element.dispatchEvent(new window.MouseEvent('click',{bubbles:true,detail:1}))
await act(async()=>pointerClick(document.querySelector('.mobile-menu-button')))
assert.equal(navDialog.open,true)
assert.equal(navigationAnimations.at(-1).options.duration,300)
assert.equal(navigationAnimations.at(-1).frames[0].transform,'translateX(-100%)')
await act(async()=>navigationAnimations.at(-1).finish())
await act(async()=>pointerClick(document.querySelector('.nav-close')))
assert.equal(navDialog.open,true,'Dialog must stay modal until exit animation finishes')
assert.equal(navDialog.dataset.closing,'true')
await act(async()=>navigationAnimations.at(-1).finish())
assert.equal(navDialog.open,false)
assert.equal(navDialog.dataset.closing,undefined)
await act(async()=>pointerClick(document.querySelector('.mobile-menu-button')))
await act(async()=>pointerClick(document.querySelector('.nav-close')))
await act(async()=>navigationAnimations.at(-1).finish())
assert.equal(navDialog.open,false,'Rapid open/close must not leave dialog stuck')
window.matchMedia=()=>({matches:true})
const animationCount=navigationAnimations.length
await act(async()=>pointerClick(document.querySelector('.mobile-menu-button')))
await act(async()=>pointerClick(document.querySelector('.nav-close')))
assert.equal(navDialog.open,false)
assert.equal(navigationAnimations.length,animationCount,'Reduced motion skips navigation animation')
window.matchMedia=()=>({matches:false})
const account=document.querySelector('.sidebar .account-menu')
await act(async()=>account.querySelector('summary').click())
assert.equal(signOuts,0,'Opening account menu must not sign out')
assert.equal(account.open,true)
await act(async()=>account.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})))
assert.equal(account.open,false,'Escape closes account disclosure')
await act(async()=>[...document.querySelectorAll('.sidebar button')].find(b=>b.querySelector('span')?.textContent==='My work').click())
assert.equal(document.querySelector('.sidebar [aria-current="page"] span').textContent,'My work')
await act(async()=>new Promise(resolve=>setTimeout(resolve,200)))
assert.equal(document.querySelector('h1').textContent,'My work')
await act(async()=>[...document.querySelectorAll('.sidebar button')].find(b=>b.querySelector('span')?.textContent==='Overview').click())
await act(async()=>new Promise(resolve=>setTimeout(resolve,200)))
await act(async()=>account.querySelector('summary').click())
await act(async()=>[...account.querySelectorAll('button')].find(b=>b.textContent==='Sign out').click())
assert.equal(signOuts,1,'Only explicit Sign out action signs out')
role='lead'
await act(async()=>window.dispatchEvent(new window.Event('focus')))
assert.match(document.body.textContent,/Your cohort at a glance/,'Role must refresh from database on window focus')
assert.ok([...document.querySelectorAll('button')].some(button=>button.textContent.includes('Cohort tasks')),'Lead role exposes cohort task navigation')
fail=true
await act(async()=>window.dispatchEvent(new window.Event('focus')))
assert.ok(!document.body.textContent.includes('Hello, EIF Fellow'),'Profile failures must not fall back to intern')
assert.match(document.body.textContent,/Profile unavailable/)
await act(async()=>root.unmount())
console.log('PASS: profile role refresh and no intern fallback on profile errors')
