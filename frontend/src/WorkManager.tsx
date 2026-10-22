import {requirementState,requirementLabels} from '../../shared/workflow-rules.mjs'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Role, View } from './data'
import SubmissionBin from './SubmissionBin'
import DetailDrawer from './DetailDrawer'
import StatusBadge from './StatusBadge'
import {useCompletionFlash,useRowGlide} from './motion'
import type {SubmissionRow} from './submissions'

type RecordItem = { id: string; title: string; cohort_id?: string; description?: string; project_name?: string; project_id?: string|null; sprint_id?: string|null; milestone_id?: string|null; assignee_id?: string | null; due_date?: string; due_at?: string; removing?: boolean; priority?: string; status?: string; starts_at?: string; event_type?: string; location?: string }
type Member = { id: string; display_name: string; role: string }
type Sprint = {id:string;project_id:string;title:string;sequence:number}
type Project = {id:string;title:string;team_id:string}
type Milestone = {id:string;title:string;project_id:string;sprint_id:string}
type Submission = SubmissionRow
type Editor = { kind: 'record'; item?: RecordItem; closing?: boolean; seq: number }
type Props = { client: SupabaseClient; role: Role; view: View; userId: string; cohortId: string; onChanged: () => void; focusedRecordId?: string; onFocusConsumed?: () => void }
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
export default function WorkManager({client,role,view,userId,cohortId,onChanged,focusedRecordId,onFocusConsumed}:Props) {
 const table=view==='work'?'tasks':view==='requirements'?'requirements':'events'
 const singular=table==='tasks'?'task':table==='requirements'?'requirement':'event'
 const [records,setRecords]=useState<RecordItem[]>([])
 const [members,setMembers]=useState<Member[]>([])
 const [sprints,setSprints]=useState<Sprint[]>([])
 const [projects,setProjects]=useState<Project[]>([])
 const [milestones,setMilestones]=useState<Milestone[]>([])
 const [submissions,setSubmissions]=useState<Submission[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [editor,setEditor]=useState<Editor|null>(null)
 const [detailId,setDetailId]=useState<string|null>(null)
 const [dirty,setDirty]=useState(false)
 const [busySubmissions,setBusySubmissions]=useState<Set<string>>(()=>new Set())
 function submissionBusy(key:string,value:boolean){setBusySubmissions(previous=>{if(previous.has(key)===value)return previous;const next=new Set(previous);if(value)next.add(key);else next.delete(key);return next})}
 const [editorDirty,setEditorDirty]=useState(false)
 const [removing,setRemoving]=useState<RecordItem|null>(null)
 const [revision,setRevision]=useState(0)
 const [filter,setFilter]=useState('')
 const [dueFilter,setDueFilter]=useState('all')
 const [sprintFilter,setSprintFilter]=useState('all')
 const [priorityFilter,setPriorityFilter]=useState('all')
 const [statusFilter,setStatusFilter]=useState('all')
 const {flash,clear,isFlashing}=useCompletionFlash()
 const completing=useRef(new Set<string>())
 const editorSeq=useRef(0)
 const list=useRef<HTMLDivElement>(null),submissionRows=useRef<HTMLDivElement>(null)
 useRowGlide(list,'.work-row');useRowGlide(submissionRows,'.submission-list > div')
 useEffect(()=>{
  let active=true
  setLoading(true);setError('');setEditor(current=>current?.closing?current:null);setRemoving(null)
  async function load(){
   try {
    const [result,people,submitted,sprintRows,projectRows,milestoneRows]=await Promise.all([
     client.from(table).select('*').eq('cohort_id',cohortId).order(table==='events'?'starts_at':'due_date'),
     role==='lead'?client.from('profiles').select('id,display_name,role').eq('cohort_id',cohortId):Promise.resolve({data:[],error:null}),
     table==='requirements'?client.from('requirement_submissions').select('*'):Promise.resolve({data:[],error:null}),
     table==='tasks'?client.from('sprints').select('id,project_id,title,sequence').eq('cohort_id',cohortId).order('sequence'):Promise.resolve({data:[],error:null}),
     table==='tasks'?client.from('projects').select('id,title,team_id').eq('cohort_id',cohortId):Promise.resolve({data:[],error:null}),
     table==='tasks'?client.from('milestones').select('id,title,project_id,sprint_id').eq('cohort_id',cohortId):Promise.resolve({data:[],error:null}),
    ])
    if(result.error||people.error||submitted.error||sprintRows.error||projectRows.error||milestoneRows.error)throw result.error||people.error||submitted.error||sprintRows.error||projectRows.error||milestoneRows.error
    if(active){completing.current.forEach(flash);completing.current.clear();setRecords(result.data||[]);setMembers(people.data||[]);setSubmissions(submitted.data||[]);setSprints(sprintRows.data||[]);setProjects(projectRows.data||[]);setMilestones(milestoneRows.data||[])}
   }catch(e){if(active){completing.current.clear();setError(message(e))}}finally{if(active)setLoading(false)}
  }
  void load();return()=>{active=false}
 },[client,cohortId,role,table,revision])
 useEffect(()=>{setRecords([]);setSubmissions([]);setMembers([]);setSprints([]);setProjects([]);setMilestones([]);setDetailId(null);setDirty(false);setFilter('');setDueFilter('all');setSprintFilter('all');setPriorityFilter('all');setStatusFilter('all')},[cohortId,role,table])
 useEffect(()=>{if(!focusedRecordId||loading)return;if(records.some(r=>r.id===focusedRecordId)){setDetailId(focusedRecordId);setDirty(false)}else setError('This item is unavailable. It may have been removed or you may not have access.');onFocusConsumed?.()},[focusedRecordId,loading,records,onFocusConsumed])
 function message(e:unknown){return typeof e==='object'&&e&&'message' in e?String(e.message):'Could not save. Please try again.'}
 async function write(operation:()=>PromiseLike<{data:unknown;error:unknown}>,success:string){
  if(busy)return false
  setBusy(true);setError('');setNotice('')
  try{const result=await operation();if(result.error)throw result.error;if(!Array.isArray(result.data)||!result.data.length)throw new Error('No record was saved. Refresh and check your permissions.');setEditor(current=>current&&{...current,closing:true});setRemoving(null);setNotice(success);setRevision(v=>v+1);onChanged();return true}catch(e){setError(message(e));return false}finally{setBusy(false)}
 }
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||!editor||editor.closing)return
  const values=new FormData(event.currentTarget)
  const text=(key:string)=>String(values.get(key)||'').trim()
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
   if(table==='tasks'){
    const milestone=text('milestone_id')?milestones.find(m=>m.id===text('milestone_id')):null
    const sprint=sprints.find(s=>s.id===(milestone?.sprint_id||text('sprint_id')))
    if((text('sprint_id')&&!sprint)||(text('milestone_id')&&!milestone)||(milestone&&text('sprint_id')&&milestone.sprint_id!==text('sprint_id'))){setError('Choose a milestone in the selected sprint.');return}
    const project=projects.find(p=>p.id===(sprint?.project_id||text('project_id')))
    if((text('project_id')&&!project)||(project&&sprint&&text('project_id')&&project.id!==text('project_id'))){setError('Choose a sprint in the selected project.');return}
    Object.assign(payload,{project_name:project?.title||text('project_name')||'Fellowship work',priority:text('priority'),status:text('status'),sprint_id:sprint?.id||null,project_id:project?.id||null,project_team_id:project?.team_id||null,milestone_id:milestone?.id||null})
   }
   else {
    const exact=text('due_at');const cutoff=exact?new Date(`${exact}:00+08:00`):null
    if(cutoff&&Number.isNaN(cutoff.getTime())){setError('Choose a valid exact deadline.');return}
    payload.due_at=cutoff?.toISOString()||null
    if(!editor.item)payload.status='pending'
   }
  }
  await write(()=>editor.item?client.from(table).update(payload).eq('id',editor.item.id).eq('cohort_id',cohortId).select('id'):client.from(table).insert({...payload,cohort_id:cohortId}).select('id'),`${singular[0].toUpperCase()+singular.slice(1)} saved.`)
 }
 async function removeRequirement(id:string){
  const {data:{session}}=await client.auth.getSession()
  if(!session)throw new Error('Sign in again.')
  const response=await fetch('/api/submissions/remove',{method:'DELETE',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({id})})
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Removal failed.');return {data:result.data,error:null}
 }
 function taskStatus(item:RecordItem,status:string){if(status!=='completed'){clear(item.id);completing.current.delete(item.id)}
  void write(()=>client.from('tasks').update({status}).eq('id',item.id).eq('assignee_id',userId).eq('cohort_id',cohortId).select('id'),'Task status saved.').then(saved=>{if(saved&&status==='completed'){completing.current.add(item.id);flash(item.id)}})}
 const mine=(r:RecordItem)=>submissions.find(s=>s.requirement_id===r.id&&s.user_id===userId)
 const [clock,setClock]=useState(new Date())
 useEffect(()=>{if(table!=='requirements')return;const timer=setInterval(()=>setClock(new Date()),1000);return()=>clearInterval(timer)},[table])
 const state=(r:RecordItem,owner=userId)=>requirementState(r,owner,submissions,clock)
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const matches=(r:RecordItem)=>{
  if(!`${r.title} ${r.description||''}`.toLowerCase().includes(filter.toLowerCase()))return false
  if(table==='requirements')return statusFilter==='all'||(role==='intern'?state(r)===statusFilter:members.filter(m=>m.role==='intern'&&(r.assignee_id===null||r.assignee_id===m.id)).some(m=>state(r,m.id)===statusFilter))
  if(table!=='tasks')return true
  if(sprintFilter!=='all'&&(sprintFilter==='none'?!!r.sprint_id:r.sprint_id!==sprintFilter))return false
  if(priorityFilter!=='all'&&r.priority!==priorityFilter)return false
  if(statusFilter!=='all'&&r.status!==statusFilter)return false
  if(dueFilter==='overdue')return !!r.due_date&&r.due_date<today&&r.status!=='completed'
  if(dueFilter==='today')return r.due_date===today
  if(dueFilter==='next7')return !!r.due_date&&r.due_date>=today&&r.due_date<=new Date(Date.parse(`${today}T00:00:00+08:00`)+6*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'})
  if(dueFilter==='upcoming')return !!r.due_date&&r.due_date>=today
  if(dueFilter==='none')return !r.due_date
  return true
 }
 // A just-completed row stays through its ~600ms animation even if the filter now hides it.
 const shown=records.filter(r=>matches(r)||isFlashing(r.id))
 return <section className={`panel work-manager work-${table}`}>
  <div className="panel-heading"><div><h2>{table==='tasks'?'Tasks':table==='requirements'?'Requirements':'Events'}</h2></div><div className="manager-actions"><button className="text-button" disabled={busy||loading} onClick={()=>setRevision(v=>v+1)}>Refresh</button>{role==='lead'&&<button className="primary-button" disabled={loading||busy} onClick={()=>{setError('');setEditorDirty(false);setEditor({kind:'record',seq:++editorSeq.current})}}>Add {singular}</button>}</div></div>
  {error&&<p className="auth-error" role="alert">{error}</p>}{notice&&<p role="status" className="manager-notice">{notice}</p>}
  {editor&&<DetailDrawer key={editor.seq} title={`${editor.item?'Edit':'Add'} ${singular}`} busy={busy} dirty={editorDirty} closeRequested={!!editor.closing} onClose={()=>setEditor(null)}><form key={`${editor.kind}:${editor.item?.id || 'new'}`} className="record-form" onChange={()=>setEditorDirty(true)} onSubmit={save} noValidate aria-busy={busy}>
   {error&&<p role="alert" className="auth-error">{error}</p>}
   <fieldset disabled={busy}>
   <>
    <label>Title<input name="title" defaultValue={editor.item?.title||''} maxLength={200} required/></label>
    {table==='events'?<><label>Date and time (Philippine time)<input name="starts_at" type="datetime-local" defaultValue={localEventTime(editor.item?.starts_at)} required/></label><label>Event type<input name="event_type" defaultValue={editor.item?.event_type||'Fellowship event'}/></label><label>Location<input name="location" defaultValue={editor.item?.location||'Online'}/></label></>:<>
     <label>Instructions / description<textarea name="description" defaultValue={editor.item?.description||''}/></label>
     <label>Assign to<select name="assignee_id" defaultValue={editor.item?.assignee_id||''}><option value="">{table==='tasks'?'Shared cohort task (view only for interns)':'All interns (individual submissions)'}</option>{members.filter(m=>m.role==='intern').map(m=><option key={m.id} value={m.id}>{m.display_name}</option>)}</select></label>
     <label>Deadline<input name="due_date" type="date" defaultValue={editor.item?.due_date||''}/></label>
     {table==='requirements'&&<label>Exact cutoff (optional, Philippine time)<input name="due_at" type="datetime-local" defaultValue={localEventTime(editor.item?.due_at)}/><small>Overrides the date above. Clear to use the end of the deadline date.</small></label>}
     {table==='tasks'&&<><label>Project label for tasks without a project<input name="project_name" defaultValue={editor.item?.project_name||'Fellowship work'}/></label><label>Project<select name="project_id" defaultValue={editor.item?.project_id||''}><option value="">No project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label><label>Sprint<select name="sprint_id" defaultValue={editor.item?.sprint_id||''}><option value="">No sprint</option>{sprints.map(s=><option key={s.id} value={s.id}>{projects.find(p=>p.id===s.project_id)?.title||'Project'} · {s.title}</option>)}</select><small>Select a sprint to link this task to its project.</small></label><label>Milestone<select name="milestone_id" defaultValue={editor.item?.milestone_id||''}><option value="">No milestone</option>{milestones.map(m=><option key={m.id} value={m.id}>{projects.find(p=>p.id===m.project_id)?.title||'Project'} · {m.title}</option>)}</select></label><label>Priority<select name="priority" defaultValue={editor.item?.priority||'medium'}>{['low','medium','high'].map(p=><option key={p}>{p}</option>)}</select></label><label>Status<select name="status" defaultValue={editor.item?.status||'to_do'}>{['to_do','in_progress','for_review','completed'].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label></>}
    </>}
   </>
   <div className="manager-actions"><button className={`primary-button${busy?' is-busy':''}`} type="submit">{busy?'Saving…':'Save'}</button></div>
   </fieldset>
  </form></DetailDrawer>}
  <div className="filter-toolbar"><label className="manager-search">Search {table}<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder={`Search ${table}`}/></label>
  {table==='tasks'&&<div className="work-filters"><label>Due date<select value={dueFilter} onChange={e=>setDueFilter(e.target.value)}><option value="all">All dates</option><option value="overdue">Overdue</option><option value="today">Today</option><option value="next7">Next seven days</option><option value="upcoming">Today or later</option><option value="none">No deadline</option></select></label><label>Sprint<select value={sprintFilter} onChange={e=>setSprintFilter(e.target.value)}><option value="all">All sprints</option><option value="none">No sprint</option>{sprints.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label><label>Priority<select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}><option value="all">All priorities</option>{['low','medium','high'].map(p=><option key={p} value={p}>{p}</option>)}</select></label><label>Status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option>{['to_do','in_progress','for_review','completed'].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label>{(filter||dueFilter!=='all'||sprintFilter!=='all'||priorityFilter!=='all'||statusFilter!=='all')&&<button className="text-button" onClick={()=>{setFilter('');setDueFilter('all');setSprintFilter('all');setPriorityFilter('all');setStatusFilter('all')}}>Reset filters</button>}</div>}
  {table==='requirements'&&<label>Requirement status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option>{Object.entries(requirementLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
  {table!=='tasks'&&(filter||statusFilter!=='all')&&<button className="text-button" onClick={()=>{setFilter('');setStatusFilter('all')}}>Reset filters</button>}</div>
  {(!loading||records.length>0)&&<p className="filter-summary">{shown.length} {singular}{shown.length===1?'':'s'}{shown.length!==records.length?` of ${records.length}`:''}</p>}
  {loading&&!records.length?<p role="status">Loading {table}…</p>:<div ref={list} className="manager-list">{shown.map(r=><article className={`manager-record work-row${isFlashing(r.id)?` is-completing${matches(r)?'':' is-leaving'}`:''}`} key={r.id}>
   <div className="work-row-main"><div className="manager-record-heading">{isFlashing(r.id)&&<svg className="complete-check" aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5 6.5 12 13 4.5"/></svg>}<h3><button className="record-open" onClick={()=>{setDirty(false);setDetailId(r.id)}}>{r.title}</button></h3></div>
   <p className="manager-meta">{table==='events'?`${dateLabel(r.starts_at,true)} · ${r.event_type} · ${r.location||'Location to follow'}`:`${r.due_at?dateLabel(r.due_at,true):dateLabel(r.due_date)} · ${r.assignee_id?(members.find(m=>m.id===r.assignee_id)?.display_name||(r.assignee_id===userId?'Assigned to you':'Assigned intern')):'Shared with cohort'}`}</p>
   {table==='tasks'&&<p className="manager-meta">{projects.find(p=>p.id===r.project_id)?.title||r.project_name||'Fellowship work'} · {sprints.find(s=>s.id===r.sprint_id)?.title||'No sprint'}</p>}
   {r.removing&&<p role="status">Removal is paused. Retry Remove to finish cleanup.</p>}
   </div>
   <div className="record-status">{table==='tasks'&&<><span>{r.priority||'medium'} priority</span>{role==='intern'&&r.assignee_id===userId?<label><span className="sr-only">Task status</span><select aria-label={`Status for ${r.title}`} value={r.status} disabled={busy} onChange={e=>taskStatus(r,e.target.value)}>{['to_do','in_progress','for_review','completed'].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label>:<StatusBadge status={r.status||'to_do'}/>}</>}
   {table==='requirements'&&(role==='intern'?<StatusBadge status={state(r)}/>:<span>{submissions.filter(s=>s.requirement_id===r.id&&s.status==='in_review').length} awaiting review</span>)}
   {table==='requirements'&&<button className="text-button" onClick={()=>{setDirty(false);setDetailId(r.id)}}>{role==='lead'?'Review submissions':'Open requirement'}</button>}
   </div>
   {role==='lead'&&<div className="manager-actions"><button className="text-button" disabled={busy||r.removing} onClick={()=>{setError('');setRemoving(null);setEditorDirty(false);setEditor({kind:'record',item:r,seq:++editorSeq.current})}}>Edit</button><button className="text-button danger-button" disabled={busy} onClick={()=>{setError('');setEditor(null);setRemoving(r)}}>Remove</button></div>}
   {role==='lead'&&removing?.id===r.id&&<section className="remove-confirmation" role="region" aria-labelledby={`remove-${r.id}`}><h4 id={`remove-${r.id}`}>Remove “{r.title}”?</h4><p>This permanently removes the {singular} from your cohort.{table==='requirements'?' Linked intern submissions will also be removed.':''}</p><div className="manager-actions"><button autoFocus className="text-button" disabled={busy} onClick={()=>setRemoving(null)}>Keep {singular}</button><button className={`primary-button danger-button${busy?' is-busy':''}`} disabled={busy} onClick={()=>{if(role==='lead')void write(()=>table==='requirements'?removeRequirement(r.id):client.from(table).delete().eq('id',r.id).eq('cohort_id',cohortId).select('id'),`${singular[0].toUpperCase()+singular.slice(1)} removed.`)}}>{busy?'Removing…':`Remove ${singular}`}</button></div></section>}

  </article>)}{!shown.length&&<p>{records.length?'No records match these filters.':`No ${table} yet. ${role==='lead'?`Use Add ${singular} to get started.`:'Your lead will add records here.'}`}</p>}</div>}
  {detailId&&records.find(r=>r.id===detailId)&&(()=>{const r=records.find(r=>r.id===detailId)!;return <DetailDrawer key={r.id} title={r.title} dirty={dirty} busy={busySubmissions.size>0||busy} onClose={()=>{setDetailId(null);setDirty(false)}}>
   <div className="record-detail"><p className="manager-meta">{r.due_at?dateLabel(r.due_at,true):table==='events'?dateLabel(r.starts_at,true):dateLabel(r.due_date)}</p>{r.description&&<p className="record-description">{r.description}</p>}
    {table==='tasks'&&<><p className="manager-meta">{projects.find(p=>p.id===r.project_id)?.title||r.project_name||'Fellowship work'} · {sprints.find(s=>s.id===r.sprint_id)?.title||'No sprint'} · {r.priority||'medium'} priority</p>{role==='intern'&&r.assignee_id===userId?<label>Task status<select aria-label={`Detail status for ${r.title}`} value={r.status} disabled={busy} onChange={e=>taskStatus(r,e.target.value)}>{['to_do','in_progress','for_review','completed'].map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label>:<StatusBadge status={r.status||'to_do'}/>}{error&&<p role="alert" className="auth-error">{error}</p>}{notice&&<p role="status">{notice}</p>}</>}
    {table==='events'&&<p>{r.event_type} · {r.location||'Location to follow'}</p>}
   {table==='requirements'&&(role==='intern'?<SubmissionBin client={client} role={role} userId={userId} requirement={r} submission={mine(r)} onBusyChange={value=>submissionBusy(`${r.id}:${userId}`,value)} onDirtyChange={setDirty} onChanged={()=>{setRevision(v=>v+1);onChanged()}}/>:<div ref={submissionRows} className="submission-list"><h4>Intern submissions</h4>{submissions.filter(s=>s.requirement_id===r.id).map(s=>{const rowKey=`${r.id}:${s.user_id}`;return <div key={s.user_id} className={isFlashing(rowKey)?'is-completing':undefined}><strong>{members.find(m=>m.id===s.user_id)?.display_name||'Intern'}</strong>{isFlashing(rowKey)&&<svg className="complete-check" aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5 6.5 12 13 4.5"/></svg>}<SubmissionBin client={client} role={role} userId={userId} requirement={r} submission={s} onBusyChange={value=>submissionBusy(rowKey,value)} onDirtyChange={setDirty} onChanged={()=>{flash(rowKey);setRevision(v=>v+1);onChanged()}}/></div>})}{!submissions.some(s=>s.requirement_id===r.id)&&<p>No submissions yet.</p>}</div>)}
   </div>
  </DetailDrawer>})()}

 </section>
}
