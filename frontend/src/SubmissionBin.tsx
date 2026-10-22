import {requirementState} from '../../shared/workflow-rules.mjs'
import {useEffect,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {canEditSubmission,submissionCutoff,submissionLinks,validSubmissionLink,validateAttachment} from './submissions'
import type {SubmissionRow,SubmissionRequirement} from './submissions'
import StatusBadge from './StatusBadge'
type Attachment={id:string;name:string;object_path:string;size:number;uploaded:boolean}
type Props={client:SupabaseClient;role:string;userId:string;requirement:SubmissionRequirement&{id:string};submission?:SubmissionRow;onChanged:()=>void;onDirtyChange?:(dirty:boolean)=>void;onBusyChange?:(busy:boolean)=>void}
export default function SubmissionBin({client,role,userId,requirement,submission,onChanged,onDirtyChange,onBusyChange}:Props){
 const changed=useRef(false)
 const busyCallback=useRef(onBusyChange)
 busyCallback.current=onBusyChange
 const owner=submission?.user_id||userId
 const [current,setCurrent]=useState(submission)
 const [links,setLinks]=useState(submission?submissionLinks(submission).join('\n'):'')
 const [note,setNote]=useState(submission?.note||'')
 const [files,setFiles]=useState<Attachment[]>([])
 const [busy,setBusy]=useState(false),[acting,setActing]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const [revision,setRevision]=useState(0),[clock,setClock]=useState(new Date())
 useEffect(()=>{setCurrent(submission);setLinks(submission?submissionLinks(submission).join('\n'):'');setNote(submission?.note||'')},[submission])
 useEffect(()=>{const timer=setInterval(()=>setClock(new Date()),1000);return()=>clearInterval(timer)},[])
 useEffect(()=>{let active=true;void Promise.resolve(client.from('submission_files').select('id,name,object_path,size,uploaded').eq('requirement_id',requirement.id).eq('user_id',owner).order('created_at')).then(({data,error})=>{if(active){if(error)setError(error.message);else setFiles(data||[])}});return()=>{active=false}},[client,requirement.id,owner,revision])
 useEffect(()=>{busyCallback.current?.(busy);return()=>busyCallback.current?.(false)},[busy])
 useEffect(()=>{onDirtyChange?.(role==='intern'&&(links!==(current?submissionLinks(current).join('\n'):'')||note!==(current?.note||'')))},[links,note,current,role,onDirtyChange])
 const cutoff=submissionCutoff(requirement),expired=!!cutoff&&clock.getTime()>=Date.parse(cutoff)
 const state=requirementState(requirement,owner,current?[current]:[],clock)
 const editable=role==='intern'&&owner===userId&&canEditSubmission(requirement,current,clock)
 const message=(e:unknown)=>e&&typeof e==='object'&&'message'in e?String(e.message):'Could not save. Please try again.'
 async function action(work:()=>Promise<void>,key=''){if(busy)return;setBusy(true);setActing(key);setError('');setNotice('');try{await work();setRevision(v=>v+1)}catch(e){setError(message(e))}finally{setBusy(false);setActing('');if(changed.current){changed.current=false;onChanged()}}}
 async function draft(){
  const values=links.split('\n').map(v=>v.trim()).filter(Boolean)
  if(values.length>10||values.some(v=>!validSubmissionLink(v)))throw new Error('Enter up to ten valid HTTP or HTTPS links, one per line.')
  const payload={requirement_id:requirement.id,user_id:userId,submission_url:values[0]||null,links:values.slice(1),note,status:'draft',reviewed_at:null}
  const {data,error}=await client.from('requirement_submissions').upsert(payload,{onConflict:'requirement_id,user_id'}).select('*').single()
  if(error)throw error;if(!data)throw new Error('Draft was not saved.');setCurrent(data);changed.current=true;return data as SubmissionRow
 }
 async function changeStatus(status:string){
  const {data,error}=await client.from('requirement_submissions').update({status}).eq('requirement_id',requirement.id).eq('user_id',owner).select('*').single()
  if(error)throw error;if(!data)throw new Error('Submission was not changed.');setCurrent(data);setNotice(status==='draft'?'Unsubmitted. You can edit before the deadline.':status==='in_review'?'Submitted for lead review.':'Review saved.');changed.current=true
 }
 async function upload(selected:File[]){
  if(files.length+selected.length>5)throw new Error('Maximum five attachments. Remove a file before adding more.')
  for(const file of selected){const reason=validateAttachment(file);if(reason)throw new Error(reason)}
  await draft()
  for(const file of selected){
   const id=crypto.randomUUID(),extension=file.name.split('.').pop()!.toLowerCase()
   const {data,error}=await client.from('submission_files').insert({id,requirement_id:requirement.id,user_id:userId,name:file.name.slice(0,200),extension,mime_type:file.type,size:file.size,object_path:`${userId}/${requirement.id}/${id}.${extension}`}).select('*').single()
   if(error)throw error
   setFiles(previous=>[...previous,data])
   const uploaded=await client.storage.from('eif-submissions').upload(data.object_path,file,{contentType:file.type,upsert:false})
   if(uploaded.error)throw new Error(`${file.name}: upload failed. Remove the pending file and try again.`)
   const finished=await client.rpc('finish_submission_upload',{file_id:id});if(finished.error)throw finished.error
   setFiles(previous=>previous.map(f=>f.id===id?{...f,uploaded:true}:f))
  }
  setNotice('Files saved to your draft. Submit when ready.')
 }
 async function remove(file:Attachment){
  const result=await client.storage.from('eif-submissions').remove([file.object_path]);if(result.error)throw result.error
  const deleted=await client.from('submission_files').delete().eq('id',file.id).select('id');if(deleted.error)throw deleted.error
  if(!deleted.data?.length)throw new Error('File reservation was not removed.');setFiles(previous=>previous.filter(f=>f.id!==file.id))
 }
 async function download(file:Attachment){
  const {data,error}=await client.storage.from('eif-submissions').createSignedUrl(file.object_path,60,{download:file.name});if(error)throw error
  const link=document.createElement('a');link.href=data.signedUrl;link.target='_blank';link.rel='noopener noreferrer';link.click()
 }
 return <section className="submission-bin" aria-label="Submission bin" aria-busy={busy}>
  <div className="dashboard-section-head"><h4>{role==='lead'?'Submitted work':'Your submission'}</h4><span className="badge-swap" key={state}><StatusBadge status={state}/></span></div>
  {cutoff&&<p className="manager-meta">Editing closes {new Date(cutoff).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'})} (Philippine time).</p>}
  {requirement.removing&&<p>Locked while your lead finishes removal.</p>}{expired&&<p>Locked: the deadline has passed. Your lead can still review submitted work.</p>}
  {current?.status==='draft'&&<p>Draft saved · not submitted</p>}
  {current?.status==='pending'&&<p>Changes requested by your lead</p>}
  {!current&&<p>Not submitted</p>}
  {current?.status==='completed'&&!expired&&<p>Approved work is locked.</p>}
  {error&&<p role="alert" className="auth-error">{error}</p>}{notice&&<p role="status" className="manager-notice">{notice}</p>}
  {editable?<div className="submission-fields"><label>Google Workspace or other links<textarea value={links} onChange={e=>setLinks(e.target.value)} disabled={busy} placeholder="One https:// link per line"/></label><p className="manager-meta">Share Google Docs, Sheets, Slides or Drive files with your reviewing lead. Adding a link does not change Google sharing permissions.</p><label>Note<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={5000} disabled={busy}/></label><label>Upload files (up to five, 10 MiB each)<input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg" disabled={busy} onChange={e=>{const selected=Array.from(e.target.files||[]);e.target.value='';void action(()=>upload(selected))}}/></label></div>:<>{current&&submissionLinks(current).map((url,i)=><p key={url}>{validSubmissionLink(url)?<a href={url} target="_blank" rel="noopener noreferrer">{i===0?'Open submission':`Open link ${i+1}`}</a>:<span>Invalid submission link</span>}</p>)}{current?.note&&<p className="submission-note">{current.note}</p>}</>}
  {files.map(file=><div className="submission-row" key={file.id}><span>{file.name} · {Math.ceil(file.size/1024)} KiB{!file.uploaded?' · Pending upload':''}</span>{file.uploaded&&<button className="text-button" disabled={busy} onClick={()=>void action(()=>download(file))}>Download</button>}{editable&&<button className="text-button danger-button" disabled={busy} onClick={()=>void action(()=>remove(file))}>Remove file</button>}</div>)}
  <div className="manager-actions submission-actions">{editable&&<><button className="text-button" disabled={busy} onClick={()=>void action(async()=>{await draft();setNotice('Draft saved.')} )}>Save draft</button><button className="primary-button" disabled={busy} onClick={()=>void action(async()=>{await draft();await changeStatus('in_review')})}>{busy?'Saving…':'Submit requirement'}</button></>}{role==='intern'&&!requirement.removing&&!expired&&current?.status==='in_review'&&<button className="text-button" disabled={busy} onClick={()=>void action(()=>changeStatus('draft'))}>Unsubmit to edit</button>}{role==='lead'&&!requirement.removing&&['in_review','completed'].includes(current?.status||'')&&<>{current?.status==='in_review'&&<button className={`primary-button${acting==='approve'?' is-busy':''}`} disabled={busy} onClick={()=>void action(()=>changeStatus('completed'),'approve')}>Approve</button>}<button className={`text-button${acting==='changes'?' is-busy':''}`} disabled={busy} onClick={()=>void action(()=>changeStatus('pending'),'changes')}>Request changes</button></>}</div>
 </section>
}
