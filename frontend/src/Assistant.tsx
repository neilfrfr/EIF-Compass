import {useEffect,useRef,useState} from 'react'
import type {FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Role,View} from './data'
import {historyRequest,HistoryError} from './assistant-history'
import type {Conversation,Turn,Unsaved,Page} from './assistant-history'
import './assistant.css'
export type DashboardExplanation={question:string;id:string;view:View}
type Props={client:SupabaseClient;userId:string;role:Role;cohortId:string;onNavigate:(view:View,recordId?:string)=>void;initialExplanation?:DashboardExplanation}
const starters={
 intern:[['Plan my day','Plan my day using my actual deadlines. Explain the top three next steps.'],['Explain my requirements','Explain my outstanding requirements and what I should prepare.'],['Prepare for check-in','Help me prepare an honest progress update and questions for my lead.']],
 lead:[['Brief my cohort','Give me a concise cohort briefing: overdue work, pending reviews, and suggested support actions.'],['Plan the next check-in','Draft an agenda for the next cohort check-in based on current work. Do not invent a date.'],['Draft cohort email','Draft a supportive email about upcoming deadlines. Use placeholders for unknown recipients. Do not send it.']],
} satisfies Record<Role,string[][]>
export default function Assistant({client,userId,role,cohortId,onNavigate,initialExplanation}:Props){
 const [turns,setTurns]=useState<Turn[]>([]),[conversation,setConversation]=useState<Conversation|null>(null)
 const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[paging,setPaging]=useState(false)
 const [error,setError]=useState(''),[loadError,setLoadError]=useState(false),[pending,setPending]=useState(''),[unsaved,setUnsaved]=useState<Unsaved|null>(null)
 const [partial,setPartial]=useState<{requestId:string;question:string;answer:string}|null>(null),[incomplete,setIncomplete]=useState(false)
 const [hasMore,setHasMore]=useState(false),[before,setBefore]=useState<number|null>(null),[confirm,setConfirm]=useState(false)
 const explanationStarted=useRef(false),loadedScope=useRef<number|null>(null)
 const controller=useRef<AbortController|null>(null),loadController=useRef<AbortController|null>(null),epoch=useRef(0),inFlight=useRef(false)
 const log=useRef<HTMLDivElement|null>(null),end=useRef<HTMLDivElement|null>(null)
 const questionInput=useRef<HTMLTextAreaElement|null>(null)
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
   loadedScope.current=scope;setConversation(page.conversation);setHasMore(page.has_more);setBefore(page.next_before)
   setTurns(previous=>older?[...page.turns,...previous.filter(t=>!page.turns.some(p=>p.requestId===t.requestId))]:page.turns)
   if(!older){setError('');setLoadError(false);if(page.turns.some(t=>t.requestId===unsavedRef.current?.requestId))setUnsaved(null);setPartial(previous=>previous&&page.turns.some(t=>t.requestId===previous.requestId)?null:previous)}
   if(older)requestAnimationFrame(()=>{if(log.current&&scope===epoch.current)log.current.scrollTop=oldTop+log.current.scrollHeight-oldHeight})
  }catch(e){if(!abort.signal.aborted&&scope===epoch.current){setError(e instanceof Error?e.message:'Could not load history.');if(!older)setLoadError(true)}}
  finally{if(!abort.signal.aborted&&scope===epoch.current){setLoading(false);setPaging(false)}}
 }
 useEffect(()=>{
  epoch.current++;explanationStarted.current=false;loadedScope.current=null;controller.current?.abort();loadController.current?.abort();inFlight.current=false
  setPartial(null);setIncomplete(false);setTurns([]);setConversation(null);setUnsaved(null);setInput('');setError('');setBusy(false);setPending('');setConfirm(false);setPaging(false)
  void load()
  const focus=()=>{if(!inFlight.current)void load()}
  window.addEventListener('focus',focus)
  return()=>{window.removeEventListener('focus',focus);epoch.current++;controller.current?.abort();loadController.current?.abort()}
  // Each identity scope gets its own transcript and invalidates late requests.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[client,userId,role,cohortId])
 useEffect(()=>{if(!paging)end.current?.scrollIntoView?.({block:'nearest',behavior:'auto'})},[busy,unsaved])
 useEffect(()=>{if(!initialExplanation||explanationStarted.current||loadedScope.current!==epoch.current||!conversation||loading||loadError||busy||unsaved||partial)return;explanationStarted.current=true;void ask(initialExplanation.question,initialExplanation)},[initialExplanation,conversation,loading,loadError,busy,unsaved,partial])
 const blocked=busy||loading||loadError||paging||!conversation||!!unsaved||!!partial
 async function ask(question:string,target?:DashboardExplanation){
  if(inFlight.current||blocked||!question.trim()||!conversation)return
  inFlight.current=true;setBusy(true);setError('');setPending(question);setIncomplete(false);const requestId=crypto.randomUUID();setPartial({requestId,question,answer:''})
  const abort=new AbortController(),scope=epoch.current;controller.current=abort
  try{
   const result=await historyRequest(client,'/api/assistant','POST',{message:question.trim(),...(target?{intent:'explain_next_action',expectedAction:{id:target.id,view:target.view}}:{}),stream:true,conversationId:conversation.id,requestId,generation:conversation.generation,revision:conversation.revision},abort.signal,text=>{if(!abort.signal.aborted&&scope===epoch.current)setPartial(previous=>previous?{...previous,answer:(previous.answer+text).slice(0,16000)}:previous)})
   if(abort.signal.aborted||scope!==epoch.current)return
   if(typeof result.answer!=='string')throw new Error('The assistant returned an invalid response.')
   const turn:Unsaved={conversationId:conversation.id,requestId:result.requestId,question:question.trim(),answer:result.answer,generatedAt:result.generatedAt,truncated:result.truncated,sourceRefs:result.sourceRefs||[],sources:result.sources||[],generation:conversation.generation,revision:conversation.revision}
   if(result.historySaved){setTurns(previous=>[...previous,result.turn]);setConversation(result.conversation)}
   else{setUnsaved(turn);setError(result.saveError==='generation_conflict'?'This conversation was cleared elsewhere. This answer cannot be saved. Reload history.':'This answer has not been saved. Retry saving, or reload history if another tab changed it.')}
   setInput('');setPartial(null);setIncomplete(false)
  }catch(e){if(scope===epoch.current){setIncomplete(true);setError((e instanceof Error?e.message:'Could not connect.')+' Reload history to check whether your answer was saved before asking again.');setInput(question);setLoadError(true)}}
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
   setConversation(result.conversation);setTurns([]);setUnsaved(null);setPartial(null);setIncomplete(false);setInput('');setError('');setHasMore(false);setBefore(null);setConfirm(false);setLoadError(false)
  }catch(e){if(!abort.signal.aborted&&scope===epoch.current)setError(e instanceof Error?e.message:'Could not clear history. Your conversation is kept.')}
  finally{if(scope===epoch.current){inFlight.current=false;setBusy(false)}}
 }
 function submit(e:FormEvent){e.preventDefault();void ask(input)}
 const visible=[...turns,...(unsaved?[unsaved]:[])]
 return <section className={`assistant assistant-${role}`} aria-label="Fellowship AI assistant">
  <div className="assistant-intro"><div><h2>{role==='lead'?'Your cohort, in perspective.':'Find your next step.'}</h2><p>{role==='lead'?'Make sense of cohort work and prepare your next check-in.':'A thinking partner for your fellowship work.'}</p></div><details className="assistant-options" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus()}}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))event.currentTarget.open=false}}><summary>Conversation options</summary><div><button className="text-button" onClick={()=>void load()} disabled={busy||loading||paging}>Reload history</button><button className="text-button" onClick={()=>setConfirm(true)} disabled={busy||loading||loadError||!conversation||(!turns.length&&!unsaved)}>Clear conversation</button></div></details></div>
  <details className="assistant-disclosure"><summary>Check AI suggestions. Email and calendar outputs are drafts.</summary><p>Your conversation is saved privately to your account for this role and cohort until you clear it. AI uses your permitted fellowship records through OpenRouter. Check suggestions before acting. Email and calendar outputs are drafts; nothing is sent or scheduled.</p></details>
  {confirm&&<div role="alertdialog" aria-label="Clear saved conversation"><p>Delete this conversation from your account across devices? This cannot be undone.</p><button onClick={()=>void clear()} disabled={busy}>Delete conversation</button><button onClick={()=>setConfirm(false)} disabled={busy}>Cancel</button></div>}
  {loading&&<p role="status">Loading saved conversation…</p>}
  <div ref={log} className="assistant-conversation" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions">
   {hasMore&&<button onClick={()=>void load(true)} disabled={paging||busy||loading}>{paging?'Loading earlier messages…':'Load earlier messages'}</button>}
   {!visible.length&&!busy&&!loading&&!loadError&&<div className="assistant-empty"><span className="assistant-empty-mark" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M24 4v40M4 24h40M10 10l28 28M38 10 10 38" stroke="currentColor" strokeWidth="2"/><circle cx="24" cy="24" r="10" fill="var(--surface)" stroke="currentColor" strokeWidth="2"/></svg></span><h3>{role==='lead'?'Make room for a clearer view.':'Good work starts with a clear next step.'}</h3><p>{role==='lead'?'Explore cohort progress, prepare an agenda, or draft a supportive update.':'Bring your deadlines, requirements, and check-in questions together.'} Answers use records you can access.</p></div>}
   {visible.map(t=><div key={t.requestId}><article className="assistant-message assistant-message-user"><h3>You</h3><div className="assistant-answer">{t.question}</div></article><article className="assistant-message assistant-message-assistant"><h3>EIF Compass</h3><div className="assistant-answer">{t.answer}</div>{t===unsaved&&<p className="assistant-warning">Not saved — keep this page open to retry.</p>}<p className="assistant-timestamp">Record snapshot checked {new Date(t.generatedAt).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'})} Philippine time. Saved answers may be outdated.</p>{t.truncated&&<p className="assistant-warning">This snapshot is limited. Counts are partial; check your work lists for the full picture.</p>}{!!t.sources?.length&&<details className="assistant-sources"><summary>Records available to this answer ({t.sources.length})</summary><p>Open the relevant work list to verify details.</p><div>{t.sources.map(s=><button className="text-button" key={`${s.view}:${s.id}`} onClick={()=>onNavigate(s.view,s.id)}>{s.title}</button>)}</div></details>}</article></div>)}
   {partial&&<div className="assistant-turn"><article className="assistant-message assistant-message-user"><h3>You</h3><div className="assistant-answer">{partial.question}</div></article>{(partial.answer||!incomplete)&&<article className="assistant-message assistant-message-assistant" data-state={incomplete?'incomplete':'streaming'}><h3>EIF Compass</h3><div className="assistant-answer">{partial.answer}{!incomplete&&<span className="stream-caret" aria-hidden="true"/>}</div>{!incomplete&&<p className="assistant-note">Generating…</p>}</article>}<p role="status" className={incomplete?'assistant-incomplete':undefined}>{incomplete?'Incomplete answer — not saved.':partial.answer?'Receiving response…':'Checking your records and preparing a response…'}</p></div>}
   <div ref={end}/>
  </div>
  {error&&<p className="auth-error" role="alert">{error}</p>}
  {partial&&incomplete&&<button onClick={()=>{setPartial(null);setIncomplete(false)}} disabled={busy||loading}>Discard incomplete answer</button>}
  {loadError&&<button onClick={()=>void load()} disabled={busy||loading}>Retry loading history</button>}
  {unsaved&&<><button className="text-button" disabled={busy||loading} onClick={()=>{setUnsaved(null);setError('')}}>Discard unsaved answer</button><button onClick={()=>void retrySave()} disabled={busy||loading||loadError||(unsaved.generation!==conversation?.generation||unsaved.conversationId!==conversation?.id)}>Retry saving</button>{conversation&&(unsaved.generation!==conversation.generation||unsaved.conversationId!==conversation.id)&&<p role="alert">This answer belongs to a cleared conversation and cannot be saved. Discard the unsaved answer to continue.</p>}</>}
  <div className="assistant-starters" aria-label="Suggested prompts">{starters[role].map(([label,question])=><button key={label} disabled={blocked} onClick={()=>{setInput(question);questionInput.current?.focus()}}>{label}</button>)}</div>
  <form className="assistant-composer" onSubmit={submit} aria-busy={busy}><label htmlFor="assistant-question">Ask EIF Compass</label><textarea ref={questionInput} id="assistant-question" value={input} onChange={e=>setInput(e.target.value)} maxLength={2000} rows={2} disabled={blocked} placeholder={role==='lead'?'What needs my attention this week?':'What should I work on first?'} required/><div><span>{input.length}/2,000</span>{busy&&pending&&<button type="button" className="text-button" onClick={()=>controller.current?.abort()}>Stop response</button>}<button className="primary-button" type="submit" disabled={blocked||!input.trim()}>{busy?'Preparing…':'Ask assistant'}</button></div></form>
 </section>
}
