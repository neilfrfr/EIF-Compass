import {compareInstants,deadlineInstant} from '../../shared/workflow-rules.mjs'
import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'

type Item={id:string;title:string;kind:'Event'|'Requirement deadline';at:string;description?:string;location?:string}
export default function Agenda({client,cohortId,revision}:{client:SupabaseClient;cohortId:string;revision:number}){
 const [items,setItems]=useState<Item[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
 useEffect(()=>{let active=true;setLoading(true);setError('')
  void Promise.all([client.from('events').select('id,title,starts_at,location').eq('cohort_id',cohortId),client.from('requirements').select('id,title,due_date,due_at,description').eq('cohort_id',cohortId)]).then(([events,requirements])=>{if(events.error||requirements.error)throw events.error||requirements.error;if(active)setItems([...(events.data||[]).map(e=>({id:e.id,title:e.title,kind:'Event' as const,at:e.starts_at,location:e.location})),...(requirements.data||[]).filter(r=>r.due_at||r.due_date).map(r=>({id:r.id,title:r.title,kind:'Requirement deadline' as const,at:r.due_at||new Date(Date.parse(deadlineInstant(r)!)-1).toISOString(),description:r.description}))].sort(compareInstants))}).catch(e=>{if(active)setError(e.message||'Could not load agenda.')}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[client,cohortId,revision])
 return <section className="panel agenda"><h2>Fellowship agenda</h2><p>Events and your visible requirement deadlines, in date order.</p>{error&&<p className="auth-error" role="alert">{error}</p>}{loading?<p role="status">Loading agenda…</p>:items.length?<div className="agenda-list">{items.map(item=><article key={`${item.kind}:${item.id}`}><time dateTime={item.at}>{new Date(item.at).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'})} PHT</time><div><span className="dashboard-badge">{item.kind}</span><h3>{item.title}</h3>{item.description&&<p>{item.description}</p>}{item.location&&<p>{item.location}</p>}</div></article>)}</div>:<p>No events or deadlines yet.</p>}</section>
}
