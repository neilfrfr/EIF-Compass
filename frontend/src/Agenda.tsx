import {compareInstants,deadlineInstant} from '../../shared/workflow-rules.mjs'
import {useEffect,useRef,useState} from 'react'
import type {CSSProperties} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {useRowGlide} from './motion'

type Item={id:string;title:string;kind:'Event'|'Requirement deadline';at:string;description?:string;location?:string}
export default function Agenda({client,cohortId,revision}:{client:SupabaseClient;cohortId:string;revision:number}){
 const [items,setItems]=useState<Item[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const list=useRef<HTMLDivElement>(null)
 useRowGlide(list,'.agenda-list article')
 useEffect(()=>{setItems([])},[client,cohortId])
 useEffect(()=>{let active=true;setLoading(true);setError('')
  void Promise.all([client.from('events').select('id,title,starts_at,location').eq('cohort_id',cohortId),client.from('requirements').select('id,title,due_date,due_at,description').eq('cohort_id',cohortId)]).then(([events,requirements])=>{if(events.error||requirements.error)throw events.error||requirements.error;if(active)setItems([...(events.data||[]).map(e=>({id:e.id,title:e.title,kind:'Event' as const,at:e.starts_at,location:e.location})),...(requirements.data||[]).filter(r=>r.due_at||r.due_date).map(r=>({id:r.id,title:r.title,kind:'Requirement deadline' as const,at:r.due_at||new Date(Date.parse(deadlineInstant(r)!)-1).toISOString(),description:r.description}))].sort(compareInstants))}).catch(e=>{if(active)setError(e.message||'Could not load agenda.')}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[client,cohortId,revision])
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const dayKey=(at:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at))
 const groups=new Map<string,Item[]>()
 for(const item of items){const key=dayKey(item.at);groups.set(key,[...(groups.get(key)||[]),item])}
 return <section className="panel agenda"><div className="panel-heading"><div><h2>Fellowship agenda</h2><p>Events and requirement deadlines · Philippine time</p></div></div>{error&&<p className="auth-error" role="alert">{error}</p>}{loading&&!items.length?<p role="status">Loading agenda…</p>:items.length?<div ref={list} className="agenda-list">{[...groups].map(([day,entries],index)=><section className={`agenda-day ${day===today?'agenda-today':''}`} key={day} style={{'--i':Math.min(index,6)} as CSSProperties}><h3><span className="date-tile" aria-hidden="true">{new Date(`${day}T12:00:00+08:00`).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short'})}<b>{Number(day.slice(8))}</b></span>{day===today?'Today':new Date(`${day}T12:00:00+08:00`).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',weekday:'long',month:'long',day:'numeric',year:'numeric'})}</h3>{entries.map(item=><article key={`${item.kind}:${item.id}`}><time dateTime={item.at}>{new Date(item.at).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'})}</time><div><span className={`agenda-kind ${item.kind==='Requirement deadline'?'agenda-deadline':''}`}>{item.kind}</span><h4>{item.title}</h4>{item.description&&<p>{item.description}</p>}{item.location&&<p className="manager-meta">{item.location}</p>}</div></article>)}</section>)}</div>:<div className="flow-empty"><h3>Your agenda is clear</h3><p>Events and requirement deadlines will appear here when scheduled.</p></div>}</section>
}
