import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Role, View } from './data'

type RecordItem = { id: string; title: string; cohort_id?: string; description?: string; project_name?: string; assignee_id?: string | null; due_date?: string; priority?: string; status?: string; starts_at?: string; event_type?: string; location?: string }
type Member = { id: string; display_name: string; role: string }
type Submission = { requirement_id: string; user_id: string; submission_url: string; status: string; reviewed_at: string | null }
type Editor = { kind: 'record' | 'submission'; item?: RecordItem }
type Props = { client: SupabaseClient; role: Role; view: View; userId: string; cohortId: string; onChanged: () => void }
const labels: Record<string, string> = {to_do:'To do',in_progress:'In progress',for_review:'For review',completed:'Completed',pending:'Pending',in_review:'In review',overdue:'Overdue'}
function dateLabel(value?: string, time=false) {
 if (!value) return 'No deadline'
 return new Date(time ? value : `${value}T12:00:00+08:00`).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',...(time?{hour:'numeric',minute:'2-digit'}:{})})
}
function localEventTime(value?: string) {
 if(!value) return ''
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value))
 const get=(k:string)=>p.find(x=>x.type===k)?.value
 return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
export default function WorkManager({client,role,view,userId,cohortId,onChanged}:Props) {
 const table=view==='work'?'tasks':view==='requirements'?'requirements':'events'
 const singular=table==='tasks'?'task':table==='requirements'?'requirement':'event'
 const [records,setRecords]=useState<RecordItem[]>([])
 const [members,setMembers]=useState<Member[]>([])
 const [submissions,setSubmissions]=useState<Submission[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [editor,setEditor]=useState<Editor|null>(null)
 const [removing,setRemoving]=useState<RecordItem|null>(null)
 const [revision,setRevision]=useState(0)
 const [filter,setFilter]=useState('')
 useEffect(()=>{
  let active=true
  setLoading(true);setError('');setEditor(null);setRemoving(null);setRecords([]);setSubmissions([]);setMembers([]);setFilter('')
  async function load(){
   try {
    const [result,people,submitted]=await Promise.all([
     client.from(table).select('*').eq('cohort_id',cohortId).order(table==='events'?'starts_at':'due_date'),
     role==='lead'?client.from('profiles').select('id,display_name,role').eq('cohort_id',cohortId):Promise.resolve({data:[],error:null}),
     table==='requirements'?client.from('requirement_submissions').select('*'):Promise.resolve({data:[],error:null}),
    ])
    if(result.error||people.error||submitted.error)throw result.error||people.error||submitted.error
    if(active){setRecords(result.data||[]);setMembers(people.data||[]);setSubmissions(submitted.data||[])}
   }catch(e){if(active)setError(message(e))}finally{if(active)setLoading(false)}
  }
  void load();return()=>{active=false}
 },[client,cohortId,role,table,revision])
 function message(e:unknown){return typeof e==='object'&&e&&'message' in e?String(e.message):'Could not save. Please try again.'}
 async function write(operation:()=>PromiseLike<{data:unknown;error:unknown}>,success:string){
  if(busy)return
  setBusy(true);setError('');setNotice('')
  try{const result=await operation();if(result.error)throw result.error;if(!Array.isArray(result.data)||!result.data.length)throw new Error('No record was saved. Refresh and check your permissions.');setEditor(null);setRemoving(null);setNotice(success);setRevision(v=>v+1);onChanged()}catch(e){setError(message(e))}finally{setBusy(false)}
 }
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||!editor)return
  const values=new FormData(event.currentTarget)
  const text=(key:string)=>String(values.get(key)||'').trim()
  if(editor.kind==='submission'){
   const url=text('submission_url')
   try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol)||/\s/.test(url))throw new Error()}catch{setError('Enter a valid HTTP or HTTPS submission link.');return}
   await write(()=>client.from('requirement_submissions').upsert({requirement_id:editor.item!.id,user_id:userId,submission_url:url,status:'in_review',reviewed_at:null},{onConflict:'requirement_id,user_id'}).select('requirement_id'),'Submitted for lead review.');return
  }
  if(role!=='lead'){setError('Only leads can create and edit records.');return}
  if(!text('title')){setError('A title is required.');return}
  const payload:Record<string,unknown>={title:text('title')}
  if(table==='events'){
   if(!text('starts_at')){setError('An event date and time are required.');return}
   const iso=new Date(`${text('starts_at')}:00+08:00`)
   if(Number.isNaN(iso.getTime())){setError('Choose a valid date and time.');return}
   Object.assign(payload,{starts_at:iso.toISOString(),event_type:text('event_type')||'Fellowship event',location:text('location')})
  }else{
   const assignee=text('assignee_id')||null
   if(assignee&&!members.some(m=>m.id===assignee&&m.role==='intern')){setError('Choose an intern in your cohort.');return}
   Object.assign(payload,{description:text('description'),due_date:text('due_date')||null,assignee_id:assignee})
   if(table==='tasks')Object.assign(payload,{project_name:text('project_name')||'Fellowship work',priority:text('priority'),status:text('status')})
   else if(!editor.item)payload.status='pending'
  }
  await write(()=>editor.item?client.from(table).update(payload).eq('id',editor.item.id).eq('cohort_id',cohortId).select('id'):client.from(table).insert({...payload,cohort_id:cohortId}).select('id'),`${singular[0].toUpperCase()+singular.slice(1)} saved.`)
 }
 function taskStatus(item:RecordItem,status:string){void write(()=>client.from('tasks').update({status}).eq('id',item.id).eq('assignee_id',userId).eq('cohort_id',cohortId).select('id'),'Task status saved.')}
 function review(s:Submission,status:string){void write(()=>client.from('requirement_submissions').update({status}).eq('requirement_id',s.requirement_id).eq('user_id',s.user_id).select('requirement_id'),status==='completed'?'Submission approved.':'Changes requested.')}
 const mine=(r:RecordItem)=>submissions.find(s=>s.requirement_id===r.id&&s.user_id===userId)
 function requirementStatus(r:RecordItem){const submitted=mine(r);const state=submitted?.status||r.status||'pending';if(state==='completed'||state==='in_review')return state;const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());return r.due_date&&r.due_date<today?'overdue':state}
 return <section className="panel work-manager">
  <div className="panel-heading"><div><h2>{table==='tasks'?'Tasks':table==='requirements'?'Requirements':'Events'}</h2></div><div className="manager-actions"><button className="text-button" disabled={busy||loading} onClick={()=>setRevision(v=>v+1)}>Refresh</button>{role==='lead'&&<button className="primary-button" disabled={loading||busy} onClick={()=>{setError('');setEditor({kind:'record'})}}>Add {singular}</button>}</div></div>
  {error&&<p className="auth-error" role="alert">{error}</p>}{notice&&<p role="status" className="manager-notice">{notice}</p>}
  {editor&&<form key={`${editor.kind}:${editor.item?.id || 'new'}`} className="record-form" onSubmit={save} noValidate aria-busy={busy}>
   <h3>{editor.kind==='submission'?'Submit requirement':`${editor.item?'Edit':'Add'} ${singular}`}</h3>
   <fieldset disabled={busy}>
   {editor.kind==='submission'?<label>Submission link<input name="submission_url" type="url" defaultValue={mine(editor.item!)?.submission_url||''} placeholder="https://docs.google.com/…" required/></label>:<>
    <label>Title<input name="title" defaultValue={editor.item?.title||''} maxLength={200} required/></label>
    {table==='events'?<><label>Date and time (Philippine time)<input name="starts_at" type="datetime-local" defaultValue={localEventTime(editor.item?.starts_at)} required/></label><label>Event type<input name="event_type" defaultValue={editor.item?.event_type||'Fellowship event'}/></label><label>Location<input name="location" defaultValue={editor.item?.location||'Online'}/></label></>:<>
     <label>Instructions / description<textarea name="description" defaultValue={editor.item?.description||''}/></label>
     <label>Assign to<select name="assignee_id" defaultValue={editor.item?.assignee_id||''}><option value="">{table==='tasks'?'Shared cohort task (view only for interns)':'All interns (individual submissions)'}</option>{members.filter(m=>m.role==='intern').map(m=><option key={m.id} value={m.id}>{m.display_name}</option>)}</select></label>
     <label>Deadline<input name="due_date" type="date" defaultValue={editor.item?.due_date||''}/></label>
     {table==='tasks'&&<><label>Project<input name="project_name" defaultValue={editor.item?.project_name||'Fellowship work'}/></label><label>Priority<select name="priority" defaultValue={editor.item?.priority||'medium'}>{['low','medium','high'].map(p=><option key={p}>{p}</option>)}</select></label><label>Status<select name="status" defaultValue={editor.item?.status||'to_do'}>{['to_do','in_progress','for_review','completed'].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label></>}
    </>}
   </>}
   <div className="manager-actions"><button className="primary-button" type="submit">{busy?'Saving…':editor.kind==='submission'?'Submit for review':'Save'}</button><button className="text-button" type="button" onClick={()=>setEditor(null)}>Cancel</button></div>
   </fieldset>
  </form>}
  <label className="manager-search">Search {table}<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder={`Search ${table}`}/></label>
  {loading?<p role="status">Loading {table}…</p>:<div className="manager-list">{records.filter(r=>`${r.title} ${r.description||''}`.toLowerCase().includes(filter.toLowerCase())).map(r=><article className="manager-record" key={r.id}>
   <div className="manager-record-heading"><h3>{r.title}</h3>{role==='lead'&&<div className="manager-actions"><button className="text-button" disabled={busy} onClick={()=>{setError('');setRemoving(null);setEditor({kind:'record',item:r})}}>Edit</button><button className="text-button danger-button" disabled={busy} onClick={()=>{setError('');setEditor(null);setRemoving(r)}}>Remove</button></div>}</div>
   {role==='lead'&&removing?.id===r.id&&<section className="remove-confirmation" role="region" aria-labelledby={`remove-${r.id}`}><h4 id={`remove-${r.id}`}>Remove “{r.title}”?</h4><p>This permanently removes the {singular} from your cohort.{table==='requirements'?' Linked intern submissions will also be removed.':''}</p><div className="manager-actions"><button autoFocus className="text-button" disabled={busy} onClick={()=>setRemoving(null)}>Keep {singular}</button><button className="primary-button danger-button" disabled={busy} onClick={()=>{if(role==='lead')void write(()=>client.from(table).delete().eq('id',r.id).eq('cohort_id',cohortId).select('id'),`${singular[0].toUpperCase()+singular.slice(1)} removed.`)}}>{busy?'Removing…':`Remove ${singular}`}</button></div></section>}
   {r.description&&<p>{r.description}</p>}
   <p className="manager-meta">{table==='events'?`${dateLabel(r.starts_at,true)} · ${r.event_type} · ${r.location||'Location to follow'}`:`${dateLabel(r.due_date)} · ${r.assignee_id?(members.find(m=>m.id===r.assignee_id)?.display_name||(r.assignee_id===userId?'Assigned to you':'Assigned intern')):'Shared with cohort'}`}</p>
   {table==='tasks'&&<><p className="manager-meta">{r.project_name} · {r.priority} priority</p>{role==='intern'&&r.assignee_id===userId?<label>Task status<select aria-label={`Status for ${r.title}`} value={r.status} disabled={busy} onChange={e=>taskStatus(r,e.target.value)}>{['to_do','in_progress','for_review','completed'].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label>:<span className="data-pill">{labels[r.status||'to_do']}</span>}</>}
   {table==='requirements'&&(role==='intern'?<><span className="data-pill">{labels[requirementStatus(r)]}</span>{mine(r)?.submission_url&&<p><a href={mine(r)!.submission_url} target="_blank" rel="noopener noreferrer">Open your submission</a></p>}{mine(r)?.status==='pending'&&<p>Changes requested. Update your link and submit again.</p>}{requirementStatus(r)!=='completed'&&<button className="primary-button" disabled={busy} onClick={()=>{setError('');setEditor({kind:'submission',item:r})}}>{mine(r)?'Resubmit link':'Submit link'}</button>}</>:<div className="submission-list"><h4>Intern submissions</h4>{submissions.filter(s=>s.requirement_id===r.id).map(s=><div className="submission-row" key={s.user_id}><strong>{members.find(m=>m.id===s.user_id)?.display_name||'Intern'}</strong><a href={s.submission_url} target="_blank" rel="noopener noreferrer">Open submission</a><span>{labels[s.status]}</span>{s.status==='in_review'&&<div className="manager-actions"><button className="primary-button" disabled={busy} onClick={()=>review(s,'completed')}>Approve</button><button className="text-button" disabled={busy} onClick={()=>review(s,'pending')}>Request changes</button></div>}</div>)}{!submissions.some(s=>s.requirement_id===r.id)&&<p>No submissions yet.</p>}</div>)}
  </article>)}{!records.length&&<p>No {table} yet. {role==='lead'?`Use Add ${singular} to get started.`:'Your lead will add records here.'}</p>}</div>}
 </section>
}
