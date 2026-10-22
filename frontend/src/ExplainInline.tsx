import {useEffect,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Action} from '../../shared/workflow-rules.mjs'
import type {Role} from './data'
import {historyRequest} from './assistant-history'
import type {Page,Unsaved} from './assistant-history'

export function explainQuestion(action:Action):string{
  return `Explain why “${action.title}” is my next recommended action, using its recorded reason and deadline. Give a practical first step.`
}

type Phase='idle'|'loading-history'|'streaming'|'saved'|'unsaved'|'failed'
type Props={client:SupabaseClient;userId:string;role:Role;cohortId:string;action:Action;question:string;onOpenAssistant:()=>void;onContinue:()=>void}
const errorText=(e:unknown,fallback:string)=>e instanceof Error?e.message:fallback

/** Streams the next-step explanation into the card and saves it to the same private assistant history (spec 6a). */
export default function ExplainInline({client,userId,role,cohortId,action,question,onOpenAssistant,onContinue}:Props){
  const [phase,setPhase]=useState<Phase>('idle'),[answer,setAnswer]=useState(''),[error,setError]=useState(''),[unsaved,setUnsaved]=useState<Unsaved|null>(null),[saving,setSaving]=useState(false)
  // One controller per identity/action scope; the epoch drops deltas from a request that was superseded or aborted.
  const controller=useRef<AbortController|null>(null),epoch=useRef(0)
  useEffect(()=>{
    const abort=new AbortController(),scope=++epoch.current;controller.current=abort
    const live=()=>!abort.signal.aborted&&scope===epoch.current
    setPhase('loading-history');setAnswer('');setError('');setUnsaved(null);setSaving(false)
    void (async()=>{
      try{
        const {conversation:c}:Page=await historyRequest(client,'/api/assistant/history','GET',undefined,abort.signal)
        if(!live())return
        setPhase('streaming')
        const message=question.trim(),requestId=crypto.randomUUID()
        const result=await historyRequest(client,'/api/assistant','POST',{message,intent:'explain_next_action',expectedAction:{id:action.id,view:action.view},stream:true,conversationId:c.id,requestId,generation:c.generation,revision:c.revision},abort.signal,text=>{if(live())setAnswer(previous=>(previous+text).slice(0,16000))})
        if(!live())return
        if(typeof result.answer!=='string')throw new Error('The assistant returned an invalid response.')
        setAnswer(result.answer)
        if(result.historySaved){setPhase('saved');return}
        setUnsaved({conversationId:c.id,requestId:result.requestId,question:message,answer:result.answer,generatedAt:result.generatedAt,truncated:result.truncated,sourceRefs:result.sourceRefs||[],sources:result.sources||[],generation:c.generation,revision:c.revision})
        setError(result.saveError==='generation_conflict'?'This conversation was cleared elsewhere, so this answer cannot be saved.':'');setPhase('unsaved')
      }catch(e){if(live()){setError(errorText(e,'Could not connect.'));setPhase('failed')}}
    })()
    return()=>{epoch.current++;controller.current?.abort()}
    // The question follows the action, so action.id is the request's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[client,userId,role,cohortId,action.id])

  async function retrySave(){
    if(!unsaved||saving)return
    const abort=new AbortController(),scope=epoch.current;controller.current=abort
    const live=()=>!abort.signal.aborted&&scope===epoch.current
    setSaving(true);setError('')
    try{
      await historyRequest(client,'/api/assistant/history','POST',{conversationId:unsaved.conversationId,requestId:unsaved.requestId,generation:unsaved.generation,revision:unsaved.revision,question:unsaved.question,answer:unsaved.answer,generatedAt:unsaved.generatedAt,truncated:unsaved.truncated,sourceRefs:unsaved.sourceRefs},abort.signal)
      if(live()){setUnsaved(null);setPhase('saved')}
    }catch(e){if(live())setError(errorText(e,'Saving failed.'))}
    finally{if(live())setSaving(false)}
  }

  const busy=phase==='idle'||phase==='loading-history'||phase==='streaming'
  return <div className="explain-inline" data-state={phase}>
    <div className="explain-body">
      <p className="explain-answer" aria-live="polite" aria-busy={busy}>{answer}{busy&&<span className="explain-caret" aria-hidden="true"/>}</p>
      <div className="explain-footer">
        {busy&&<span className="explain-note">Generating…</span>}
        {phase==='saved'&&<><span className="explain-note">Saved to your assistant history</span><button className="text-button" onClick={onContinue}>Continue in assistant</button></>}
        {phase==='unsaved'&&<><span className="explain-note">Not saved yet</span><button className="text-button" onClick={()=>void retrySave()} disabled={saving}>Retry saving</button></>}
        {phase==='failed'&&<><span className="explain-note is-warning">Incomplete — not saved</span><button className="text-button" onClick={onOpenAssistant}>Open in assistant</button></>}
      </div>
      {error&&<p className="explain-error" role="alert">{error}</p>}
    </div>
  </div>
}
