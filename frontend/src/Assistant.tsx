import {useEffect,useRef,useState} from 'react'
import type {FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Role,View} from './data'
import {historyRequest,HistoryError} from './assistant-history'
import type {Conversation,Turn,Unsaved,Page} from './assistant-history'
import './assistant.css'
type Props={client:SupabaseClient;userId:string;role:Role;cohortId:string;onNavigate:(view:View)=>void}
const starters={
 intern:[['Plan my day','Plan my day using my actual deadlines. Explain the top three next steps.'],['Explain my requirements','Explain my outstanding requirements and what I should prepare.'],['Prepare for check-in','Help me prepare an honest progress update and questions for my lead.']],
 lead:[['Brief my cohort','Give me a concise cohort briefing: overdue work, pending reviews, and suggested support actions.'],['Plan the next check-in','Draft an agenda for the next cohort check-in based on current work. Do not invent a date.'],['Draft cohort email','Draft a supportive email about upcoming deadlines. Use placeholders for unknown recipients. Do not send it.']],
} satisfies Record<Role,string[][]>
export default function Assistant({client,userId,role,cohortId,onNavigate}:Props){
 const [turns,setTurns]=useState<Turn[]>([]),[conversation,setConversation]=useState<Conversation|null>(null)
 const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[paging,setPaging]=useState(false)
 const [error,setError]=useState(''),[loadError,setLoadError]=useState(false),[pending,setPending]=useState(''),[unsaved,setUnsaved]=useState<Unsaved|null>(null)
 const [hasMore,setHasMore]=useState(false),[before,setBefore]=useState<number|null>(null),[confirm,setConfirm]=useState(false)
 const controller=useRef<AbortController|null>(null),loadController=useRef<AbortController|null>(null),epoch=useRef(0),inFlight=useRef(false)
 const log=useRef<HTMLDivElement|null>(null),end=useRef<HTMLDivElement|null>(null)
 const unsavedRef=useRef(unsaved);unsavedRef.current=unsaved
 async function load(older=false){
  if(older&&(!conversation||!before||inFlight.current))return
  const scope=epoch.current,abort=new AbortController();loadController.current?.abort();loadController.current=abort
  if(older)setPaging(true);else{setLoading(true);setLoadError(false)}
  const oldHeight=log.current?.scrollHeight||0,oldTop=log.current?.scrollTop||0
  try{
   const query=older?`?before=${before}&generation=${conversation!.generation}`:''
   const page:Page=await historyRequest(client,'/api/assistant/history'+query,'GET',undefined,abort.signal)
   if(abort.signal.aborted||scope!==epoch.current)return
   setConversation(page.conversation);setHasMore(page.has_more);setBefore(page.next_before)
   setTurns(previous=>older?[...page.turns,...previous.filter(t=>!page.turns.some(p=>p.requestId===t.requestId))]:page.turns)
   if(!older){setError('');setLoadError(false);if(page.turns.some(t=>t.requestId===unsavedRef.current?.requestId))setUnsaved(null)}
   if(older)requestAnimationFrame(()=>{if(log.current&&scope===epoch.current)log.current.scrollTop=oldTop+log.current.scrollHeight-oldHeight})
  }catch(e){if(!abort.signal.aborted&&scope===epoch.current){setError(e instanceof Error?e.message:'Could not load history.');if(!older)setLoadError(true)}}
  finally{if(!abort.signal.aborted&&scope===epoch.current){setLoading(false);setPaging(false)}}
 }
 useEffect(()=>{
  epoch.current++;controller.current?.abort();loadController.current?.abort();inFlight.current=false
  setTurns([]);setConversation(null);setUnsaved(null);setInput('');setError('');setBusy(false);setPending('');setConfirm(false);setPaging(false)
  void load()
  const focus=()=>{if(!inFlight.current)void load()}
  window.addEventListener('focus',focus)
  return()=>{window.removeEventListener('focus',focus);epoch.current++;controller.current?.abort();loadController.current?.abort()}
  // Each identity scope gets its own transcript and invalidates late requests.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[client,userId,role,cohortId])
 useEffect(()=>{if(!paging)end.current?.scrollIntoView?.({block:'nearest',behavior:'auto'})},[busy,unsaved])
 const blocked=busy||loading||loadError||paging||!conversation||!!unsaved
 async function ask(question:string){
  if(inFlight.current||blocked||!question.trim()||!conversation)return
  inFlight.current=true;setBusy(true);setError('');setPending(question)
  const abort=new AbortController(),scope=epoch.current;controller.current=abort
  try{
   const result=await historyRequest(client,'/api/assistant','POST',{message:question.trim(),conversationId:conversation.id,requestId:crypto.randomUUID(),generation:conversation.generation,revision:conversation.revision},abort.signal)
   if(abort.signal.aborted||scope!==epoch.current)return
   if(typeof result.answer!=='string')throw new Error('The assistant returned an invalid response.')
   const turn:Unsaved={conversationId:conversation.id,requestId:result.requestId,question:question.trim(),answer:result.answer,generatedAt:result.generatedAt,truncated:result.truncated,sourceRefs:result.sourceRefs||[],sources:result.sources||[],generation:conversation.generation,revision:conversation.revision}
   if(result.historySaved){setTurns(previous=>[...previous,result.turn]);setConversation(result.conversation)}
   else{setUnsaved(turn);setError(result.saveError==='generation_conflict'?'This conversation was cleared elsewhere. This answer cannot be saved. Reload history.':'This answer has not been saved. Retry saving, or reload history if another tab changed it.')}
   setInput('')
  }catch(e){if(!abort.signal.aborted&&scope===epoch.current){setError((e instanceof Error?e.message:'Could not connect.')+' Reload history to check whether your answer was saved before asking again.');setInput(question);setLoadError(true)}}
  finally{if(scope===epoch.current&&controller.current===abort){inFlight.current=false;setBusy(false);setPending('')}}
 }
 async function retrySave(){
  if(inFlight.current||!unsaved||!conversation||(unsaved.generation!==conversation.generation||unsaved.conversationId!==conversation.id)||loading||loadError)return
  inFlight.current=true;setBusy(true);const abort=new AbortController(),scope=epoch.current;controller.current=abort
  try{
   const result=await historyRequest(client,'/api/assistant/history','POST',{conversationId:unsaved.conversationId,requestId:unsaved.requestId,generation:unsaved.generation,revision:conversation.revision,question:unsaved.question,answer:unsaved.answer,generatedAt:unsaved.generatedAt,truncated:unsaved.truncated,sourceRefs:unsaved.sourceRefs},abort.signal)
   if(abort.signal.aborted||scope!==epoch.current)return
   setTurns(previous=>[...previous.filter(t=>t.requestId!==result.turn.requestId),result.turn]);setConversation(result.conversation);setUnsaved(null);setError('')
  }catch(e){if(!abort.signal.aborted&&scope===epoch.current){setError(e instanceof Error?e.message:'Saving failed.');if(e instanceof HistoryError&&e.code?.includes('conflict'))setLoadError(true)}}
  finally{if(scope===epoch.current){inFlight.current=false;setBusy(false)}}
 }
 async function clear(){
  if(!conversation||inFlight.current)return
  loadController.current?.abort();epoch.current++;setLoading(false);setPaging(false);inFlight.current=true;setBusy(true);const abort=new AbortController(),scope=epoch.current;controller.current=abort
  try{
   const result=await historyRequest(client,'/api/assistant/history','DELETE',conversation,abort.signal)
   if(abort.signal.aborted||scope!==epoch.current)return
   setConversation(result.conversation);setTurns([]);setUnsaved(null);setInput('');setError('');setHasMore(false);setBefore(null);setConfirm(false);setLoadError(false)
  }catch(e){if(!abort.signal.aborted&&scope===epoch.current)setError(e instanceof Error?e.message:'Could not clear history. Your conversation is kept.')}
  finally{if(scope===epoch.current){inFlight.current=false;setBusy(false)}}
 }
 function submit(e:FormEvent){e.preventDefault();void ask(input)}
 const visible=[...turns,...(unsaved?[unsaved]:[])]
 return <section className={`assistant assistant-${role}`} aria-label="Fellowship AI assistant">
  <div className="assistant-intro"><div><h2>{role==='lead'?'A clearer picture of your cohort.':'A little help with your next step.'}</h2><p>{role==='lead'?'Turn cohort records into a useful briefing, check-in agenda, or communication draft.':'Plan your day, understand requirements, and prepare for your next check-in.'}</p></div><div><button className="text-button" onClick={()=>void load()} disabled={busy||loading||paging}>Reload history</button><button className="text-button" onClick={()=>setConfirm(true)} disabled={busy||loading||loadError||!conversation||(!turns.length&&!unsaved)}>Clear conversation</button></div></div>
  <p className="assistant-disclosure">Your conversation is saved privately to your account for this role and cohort until you clear it. AI uses your permitted fellowship records through OpenRouter. Check suggestions before acting. Email and calendar outputs are drafts; nothing is sent or scheduled.</p>
  {confirm&&<div role="alertdialog" aria-label="Clear saved conversation"><p>Delete this conversation from your account across devices? This cannot be undone.</p><button onClick={()=>void clear()} disabled={busy}>Delete conversation</button><button onClick={()=>setConfirm(false)} disabled={busy}>Cancel</button></div>}
  <div className="assistant-starters" aria-label="Suggested prompts">{starters[role].map(([label,question])=><button key={label} disabled={blocked} onClick={()=>void ask(question)}>{label}</button>)}</div>
  {loading&&<p role="status">Loading saved conversation…</p>}
  <div ref={log} className="assistant-conversation" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions">
   {hasMore&&<button onClick={()=>void load(true)} disabled={paging||busy||loading}>{paging?'Loading earlier messages…':'Load earlier messages'}</button>}
   {!visible.length&&!busy&&!loading&&!loadError&&<div className="assistant-empty"><h3>{role==='lead'?'Start with a cohort briefing':'Start with your daily plan'}</h3><p>Select a prompt above or ask a question below. Responses use a fresh snapshot of the records you can access.</p></div>}
   {visible.map(t=><div key={t.requestId}><article className="assistant-message assistant-message-user"><h3>You</h3><div className="assistant-answer">{t.question}</div></article><article className="assistant-message assistant-message-assistant"><h3>EIF Compass</h3><div className="assistant-answer">{t.answer}</div>{t===unsaved&&<p className="assistant-warning">Not saved — keep this page open to retry.</p>}<p className="assistant-timestamp">Record snapshot checked {new Date(t.generatedAt).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'})} Philippine time. Saved answers may be outdated.</p>{t.truncated&&<p className="assistant-warning">This snapshot is limited. Counts are partial; check your work lists for the full picture.</p>}{!!t.sources?.length&&<details className="assistant-sources"><summary>Records available to this answer ({t.sources.length})</summary><p>Open the relevant work list to verify details.</p><div>{t.sources.map(s=><button className="text-button" key={`${s.view}:${s.id}`} onClick={()=>onNavigate(s.view)}>{s.title}</button>)}</div></details>}</article></div>)}
   {busy&&pending&&<><article className="assistant-message assistant-message-user"><h3>You</h3><div className="assistant-answer">{pending}</div></article><p role="status">Checking your records and preparing a response…</p></>}
   <div ref={end}/>
  </div>
  {error&&<p className="auth-error" role="alert">{error}</p>}
  {loadError&&<button onClick={()=>void load()} disabled={busy||loading}>Retry loading history</button>}
  {unsaved&&<><button className="text-button" disabled={busy||loading} onClick={()=>{setUnsaved(null);setError('')}}>Discard unsaved answer</button><button onClick={()=>void retrySave()} disabled={busy||loading||loadError||(unsaved.generation!==conversation?.generation||unsaved.conversationId!==conversation?.id)}>Retry saving</button>{conversation&&(unsaved.generation!==conversation.generation||unsaved.conversationId!==conversation.id)&&<p role="alert">This answer belongs to a cleared conversation and cannot be saved. Discard the unsaved answer to continue.</p>}</>}
  <form className="assistant-composer" onSubmit={submit} aria-busy={busy}><label htmlFor="assistant-question">Ask EIF Compass</label><textarea id="assistant-question" value={input} onChange={e=>setInput(e.target.value)} maxLength={2000} rows={3} disabled={blocked} placeholder={role==='lead'?'What needs my attention this week?':'What should I work on first?'} required/><div><span>{input.length}/2,000</span><button className="primary-button" type="submit" disabled={blocked||!input.trim()}>{busy?'Preparing…':'Ask assistant'}</button></div></form>
 </section>
}
