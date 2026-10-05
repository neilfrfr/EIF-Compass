import {useEffect,useRef,useState} from 'react'
import type {FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Role,View} from './data'
import './assistant.css'

type Source={id:string;title:string;view:View}
type Message={role:'user'|'assistant';content:string;sources?:Source[];generatedAt?:string;truncated?:boolean}
type Props={client:SupabaseClient;role:Role;cohortId:string;onNavigate:(view:View)=>void}
const starters={
 intern:[['Plan my day','Plan my day using my actual deadlines. Explain the top three next steps.'],['Explain my requirements','Explain my outstanding requirements and what I should prepare.'],['Prepare for check-in','Help me prepare an honest progress update and questions for my lead.']],
 lead:[['Brief my cohort','Give me a concise cohort briefing: overdue work, pending reviews, and suggested support actions.'],['Plan the next check-in','Draft an agenda for the next cohort check-in based on current work. Do not invent a date.'],['Draft cohort email','Draft a supportive email about upcoming deadlines. Use placeholders for unknown recipients. Do not send it.']],
} satisfies Record<Role,string[][]>
export default function Assistant({client,role,cohortId,onNavigate}:Props){
 const [messages,setMessages]=useState<Message[]>([])
 const [input,setInput]=useState('')
 const [busy,setBusy]=useState(false)
 const [pending,setPending]=useState('')
 const [error,setError]=useState('')
 const controller=useRef<AbortController|null>(null)
 const inFlight=useRef(false)
 const end=useRef<HTMLDivElement|null>(null)
 useEffect(()=>{controller.current?.abort();inFlight.current=false;setMessages([]);setInput('');setError('');setBusy(false);setPending('');return()=>controller.current?.abort()},[role,cohortId])
 useEffect(()=>{end.current?.scrollIntoView?.({block:'nearest',behavior:'auto'})},[messages,busy])
 async function ask(question:string){
  if(inFlight.current||!question.trim())return
  inFlight.current=true;setBusy(true);setError('');setPending(question)
  const abort=new AbortController();controller.current=abort
  try{
   const {data,error:sessionError}=await client.auth.getSession()
   if(sessionError||!data.session)throw new Error('Your session expired. Sign in again.')
   if(abort.signal.aborted)return
   const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({message:question,history:messages.slice(-6).map(m=>({role:m.role,content:m.content.slice(0,1000)}))}),signal:abort.signal})
   let result
   try{result=await response.json()}catch{throw new Error('Assistant endpoint unavailable. For local development, start npm run dev:api as well as npm run dev.')}
   if(!response.ok)throw new Error(result.error||'The assistant could not respond. Please try again.')
   if(typeof result.answer!=='string')throw new Error('The assistant returned an invalid response. Please try again.')
   if(abort.signal.aborted)return
   setMessages(previous=>[...previous,{role:'user',content:question},{role:'assistant',content:result.answer,sources:result.sources,generatedAt:result.generatedAt,truncated:result.truncated}]);setInput('')
  }catch(e){if(!abort.signal.aborted){setError(e instanceof Error?e.message:'Could not connect. Please try again.');setInput(question)}}
  finally{if(controller.current===abort){inFlight.current=false;setBusy(false);setPending('')}}
 }
 function submit(e:FormEvent){e.preventDefault();void ask(input)}
 function clear(){controller.current?.abort();controller.current=null;inFlight.current=false;setBusy(false);setMessages([]);setError('');setPending('');setInput('')}
 return <section className={`assistant assistant-${role}`} aria-label="Fellowship AI assistant">
  <div className="assistant-intro"><div><h2>{role==='lead'?'A clearer picture of your cohort.':'A little help with your next step.'}</h2><p>{role==='lead'?'Turn cohort records into a useful briefing, check-in agenda, or communication draft.':'Plan your day, understand requirements, and prepare for your next check-in.'}</p></div><button className="text-button" onClick={clear} disabled={!messages.length&&!busy&&!error}>Clear conversation</button></div>
  <p className="assistant-disclosure">AI uses your permitted fellowship records through OpenRouter. Check suggestions before acting. Email and calendar outputs are drafts; nothing is sent or scheduled. This conversation stays in memory and clears when you leave this page.</p>
  <div className="assistant-starters" aria-label="Suggested prompts">{starters[role].map(([label,question])=><button key={label} disabled={busy} onClick={()=>void ask(question)}>{label}</button>)}</div>
  <div className="assistant-conversation" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions">
   {!messages.length&&!busy&&<div className="assistant-empty"><h3>{role==='lead'?'Start with a cohort briefing':'Start with your daily plan'}</h3><p>Select a prompt above or ask a question below. Responses use a fresh snapshot of the records you can access.</p></div>}
   {messages.map((m,i)=><article key={i} className={`assistant-message assistant-message-${m.role}`}><h3>{m.role==='user'?'You':'EIF Compass'}</h3><div className="assistant-answer">{m.content}</div>{m.generatedAt&&<p className="assistant-timestamp">Record snapshot checked {new Date(m.generatedAt).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'})} Philippine time.</p>}{m.truncated&&<p className="assistant-warning">This snapshot is limited. Counts are partial; check your work lists for the full picture.</p>}{!!m.sources?.length&&<details className="assistant-sources"><summary>Records available to this answer ({m.sources.length})</summary><p>Open the relevant work list to verify details.</p><div>{m.sources.map(s=><button className="text-button" key={`${s.view}:${s.id}`} onClick={()=>onNavigate(s.view)}>{s.title}</button>)}</div></details>}</article>)}
   {busy&&<><article className="assistant-message assistant-message-user"><h3>You</h3><div className="assistant-answer">{pending}</div></article><p role="status">Checking your records and preparing a response…</p></>}
   <div ref={end}/>
  </div>
  {error&&<p className="auth-error" role="alert">{error} Your question is kept below so you can retry.</p>}
  <form className="assistant-composer" onSubmit={submit} aria-busy={busy}><label htmlFor="assistant-question">Ask EIF Compass</label><textarea id="assistant-question" value={input} onChange={e=>setInput(e.target.value)} maxLength={2000} rows={3} disabled={busy} placeholder={role==='lead'?'What needs my attention this week?':'What should I work on first?'} required/><div><span>{input.length}/2,000</span>{busy?<button className="text-button" type="button" onClick={()=>controller.current?.abort()}>Stop response</button>:null}<button className="primary-button" type="submit" disabled={busy||!input.trim()}>{busy?'Preparing…':'Ask assistant'}</button></div></form>
 </section>
}
