import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import ts from 'typescript'
import React,{act} from 'react'
import {JSDOM} from 'jsdom'
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'})
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,MutationObserver:dom.window.MutationObserver,IS_REACT_ACT_ENVIRONMENT:true})
const {createRoot}=await import('react-dom/client')
let signInArgs=null,resolveSignIn,authListener,unsubscribed=false
const client={auth:{onAuthStateChange(listener){authListener=listener;return {data:{subscription:{unsubscribe(){unsubscribed=true}}}}},getSession:async()=>({data:{session:null},error:null}),signInWithPassword(args){signInArgs=args;return new Promise(resolve=>resolveSignIn=resolve)}}}
globalThis.__authTestClient=client
mkdirSync('.test-output',{recursive:true})
writeFileSync('.test-output/auth-test-client.js','export const supabase=globalThis.__authTestClient;')
const deps=['CompassLogo.tsx','ThemeToggle.tsx','theme.ts','motion.ts','journey.ts']
const transpile=(file,out)=>{let js=ts.transpileModule(readFileSync('src/'+file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;for(const dep of deps){const name=dep.replace(/\.tsx?$/,'');js=js.replaceAll(`'./${name}'`,`'./${name}-auth.js'`)}writeFileSync('.test-output/'+out,js)}
for(const dep of deps)transpile(dep,dep.replace(/\.tsx?$/,'-auth.js'))
transpile('AuthGate.tsx','AuthGate-auth.tmp.js')
writeFileSync('.test-output/AuthGate-auth.js',readFileSync('.test-output/AuthGate-auth.tmp.js','utf8').replace("import './auth.css';",'').replace("'./lib/supabase'","'./auth-test-client.js'"))
const {default:AuthGate}=await import('../.test-output/AuthGate-auth.js')
const root=createRoot(document.getElementById('root'))
await act(async()=>root.render(React.createElement(AuthGate,{children:session=>React.createElement('p',null,'Signed in '+session.user.id)})))
assert.match(document.body.textContent,/Welcome back/)
const email=document.getElementById('login-email'),password=document.getElementById('login-password')
const type=async(input,value)=>act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}))})
await type(email,' fellow@example.com ');await type(password,'private-password')
assert.equal(password.type,'password')
await act(async()=>document.querySelector('[aria-label="Show password"]').click())
assert.equal(password.type,'text');assert.equal(document.querySelector('[aria-label="Hide password"]').getAttribute('aria-pressed'),'true')
await act(async()=>document.querySelector('[aria-label="Hide password"]').click())
assert.equal(password.type,'password')
await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))
assert.deepEqual(signInArgs,{email:'fellow@example.com',password:'private-password'})
assert.equal(email.disabled,true);assert.equal(password.disabled,true)
await act(async()=>resolveSignIn({data:{session:null},error:{message:'Invalid login credentials'}}))
assert.match(document.querySelector('[role="alert"]').textContent,/Invalid login credentials/)
assert.equal(password.value,'private-password','Failed sign-in retains entered password for retry')
assert.equal(document.querySelector('.arrival'),null,'no arrival overlay before sign-in')
await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))
assert.equal(document.querySelector('[role="alert"]'),null,'a new attempt clears the old error')
await act(async()=>resolveSignIn({data:{session:{user:{id:'fellow'}}},error:null}))
assert.match(document.body.textContent,/Signed in fellow/,'workspace renders in the same act tick as sign-in')
const arrival=document.querySelector('.arrival')
assert.ok(arrival,'decorative arrival overlay opens after a submit')
assert.equal(arrival.getAttribute('aria-hidden'),'true')
assert.match(arrival.textContent,/Opening your workspace/)
await act(async()=>authListener('SIGNED_IN',{user:{id:'fellow'}}))
assert.match(document.body.textContent,/Signed in fellow/)
await act(async()=>root.unmount())
assert.equal(unsubscribed,true)

// A restored session (no submit) opens the workspace without the overlay; the checking state shares the workspace-loading look.
client.auth.getSession=async()=>({data:{session:{user:{id:'restored'}}},error:null})
const root2=createRoot(document.getElementById('root'))
await act(async()=>root2.render(React.createElement(AuthGate,{children:session=>React.createElement('p',null,'Signed in '+session.user.id)})))
assert.match(document.body.textContent,/Signed in restored/)
assert.equal(document.querySelector('.arrival'),null,'no overlay on session restore')
await act(async()=>root2.unmount())
client.auth.getSession=()=>new Promise(()=>{})
const root3=createRoot(document.getElementById('root'))
await act(async()=>root3.render(React.createElement(AuthGate,{children:()=>null})))
assert.ok(document.querySelector('main.login-page [role="status"]'),'session check uses the workspace-loading treatment')
assert.match(document.body.textContent,/Opening your workspace/)
await act(async()=>root3.unmount())
console.log('PASS: sign-in form, password visibility, pending state, auth errors, session transition and cleanup')
