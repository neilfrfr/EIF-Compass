import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {deriveDashboard,requirementState} from './dashboard'
import type {DashboardData} from './dashboard'
import type {Role,View} from './data'
type Props={client:SupabaseClient;role:Role;userId:string;cohortId:string;revision:number;onNavigate:(view:View)=>void}
const statusLabel:Record<string,string>={completed:'Completed',in_review:'In review',pending:'Pending',overdue:'Overdue',to_do:'To do',in_progress:'In progress',for_review:'For review'}
function day(value?:string|null){return value?new Date(`${value}T12:00:00+08:00`).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric'}):'No deadline'}
export default function Dashboard({client,role,userId,cohortId,revision,onNavigate}:Props){
 const [data,setData]=useState<DashboardData|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[selected,setSelected]=useState<string|null>(null)
 useEffect(()=>{let active=true;setLoading(true);setError('');async function load(){try{
  const [cohort,profiles,tasks,requirements,submissions,events]=await Promise.all([
   client.from('cohorts').select('id,name,starts_on,ends_on').eq('id',cohortId).maybeSingle(),
   client.from('profiles').select('id,display_name,role,team_name').eq('cohort_id',cohortId),
   client.from('tasks').select('*').eq('cohort_id',cohortId),client.from('requirements').select('*').eq('cohort_id',cohortId),client.from('requirement_submissions').select('*'),client.from('events').select('*').eq('cohort_id',cohortId)
  ])
  const failure=[cohort,profiles,tasks,requirements,submissions,events].find(r=>r.error)?.error;if(failure)throw failure;if(!cohort.data)throw new Error('Your cohort record is unavailable.')
  if(active)setData({cohort:cohort.data,profiles:profiles.data||[],tasks:tasks.data||[],requirements:requirements.data||[],submissions:submissions.data||[],events:events.data||[]})
 }catch(e){if(active){setData(null);setError(e&&typeof e==='object'&&'message' in e?String(e.message):'Could not load dashboard records.')}}finally{if(active)setLoading(false)}}void load();return()=>{active=false}},[client,role,userId,cohortId,revision])
 if(loading)return <section className="panel" role="status">Loading your dashboard…</section>
 if(error||!data)return <section className="panel" role="alert">{error||'Dashboard unavailable.'}</section>
 const m=deriveDashboard(data,role,userId)
 const selectedPerson=m.people.find(p=>p.id===selected)
 const progress=m.taskPercent===null?'—':`${m.taskPercent}%`
 const metrics=role==='lead'?[
  {label:'Interns',value:m.interns.length,detail:`${m.teams.length} named teams`},
  {label:'Task completion',value:progress,detail:`${m.completedTasks} of ${m.assignedTasks.length} cohort tasks`},
  {label:'Awaiting review',value:m.reviewQueue.length,detail:'Individual requirement submissions'},
  {label:'Overdue work',value:m.overdueTasks.length+m.overdueRequirements,detail:`${m.overdueTasks.length} tasks · ${m.overdueRequirements} intern requirements`},
 ]:[
  {label:'My task completion',value:progress,detail:`${m.completedTasks} of ${m.assignedTasks.length} assigned tasks`},
  {label:'Requirements approved',value:`${m.completedRequirements}/${m.requirementSlots}`,detail:`${m.reviewQueue.length} submitted for review`},
  {label:'Overdue work',value:m.overdueTasks.length+m.overdueRequirements,detail:'Your tasks and requirements'},
  {label:'Upcoming events',value:m.events.length,detail:'Scheduled from now onward'},
 ]
 return <div className={`role-dashboard ${role}-dashboard`}>
  <section className="dashboard-hero"><div><h2>{role==='lead'?'Cohort command center':'Your fellowship journey'}</h2><p>{data.cohort.name}</p><span className="dashboard-date">{m.week===null?'Cohort dates not set':m.week===0?'Fellowship has not started':`Week ${m.week}${m.totalWeeks?` of ${m.totalWeeks}`:''}`} · {day(data.cohort.starts_on)} – {day(data.cohort.ends_on)}</span></div><div className="hero-actions">{role==='lead'?<><button onClick={()=>onNavigate('work')}>Manage tasks →</button><button onClick={()=>onNavigate('requirements')}>Review requirements →</button><button onClick={()=>onNavigate('calendar')}>Schedule events →</button></>:<><h3>{m.nextAction?.title||'No outstanding work with a deadline'}</h3><p>{m.nextAction?`${m.nextAction.reason} · ${day(m.nextAction.date)}`:'Check your work list for items without deadlines.'}</p><button onClick={()=>onNavigate(m.nextAction?.view||'work')}>{m.nextAction?'Open item →':'View my work →'}</button></>}</div></section>
  <section className="dashboard-metrics">{metrics.map(x=><article key={x.label}><span>{x.label}</span><strong>{x.value}</strong><p>{x.detail}</p></article>)}</section>
  {role==='lead'?<>
   <div className="dashboard-columns"><section className="dashboard-panel"><div className="dashboard-section-head"><h3>Review queue</h3><button onClick={()=>onNavigate('requirements')}>Review all →</button></div>{m.reviewQueue.length?m.reviewQueue.slice(0,5).map(s=><div className="dashboard-line" key={`${s.requirement_id}-${s.user_id}`}><div><strong>{data.requirements.find(r=>r.id===s.requirement_id)?.title}</strong><p>{m.interns.find(p=>p.id===s.user_id)?.display_name||'Intern'}</p></div><span className="dashboard-badge">In review</span></div>):<p>No submissions awaiting review.</p>}</section><section className="dashboard-panel"><h3>Team task progress</h3>{m.teams.length?m.teams.map(team=><div className="team-progress" key={team.name}><div><strong>{team.name}</strong><span>{team.percent===null?'No assigned tasks':`${team.percent}%`}</span></div><progress value={team.done} max={Math.max(1,team.total)} aria-label={`${team.name} task completion`}/><p>{team.members} interns · {team.done}/{team.total} assigned tasks completed</p></div>):<p>No teams assigned to intern profiles yet.</p>}</section></div>
   <section className="dashboard-panel"><div className="dashboard-section-head"><h3>Intern progress</h3><span>Recorded tasks and requirements</span></div><div className="dashboard-table-scroll"><table className="dashboard-table"><thead><tr><th>Intern</th><th>Team</th><th>Tasks done</th><th>Requirements approved</th><th>Overdue work</th><th>Details</th></tr></thead><tbody>{m.people.map(p=><tr key={p.id}><td>{p.display_name}</td><td>{p.team_name||'Unassigned'}</td><td>{p.taskDone}/{p.taskTotal}</td><td>{p.requirementDone}/{p.requirementTotal}</td><td><span className={p.overdueTasks+p.overdueRequirements?'dashboard-badge warning':'dashboard-badge'}>{p.overdueTasks+p.overdueRequirements}</span></td><td><button onClick={()=>setSelected(selected===p.id?null:p.id)} aria-expanded={selected===p.id}>View</button></td></tr>)}</tbody></table></div>{!m.people.length&&<p>No interns in this cohort yet.</p>}
   {selectedPerson&&<div className="intern-detail"><h4>{selectedPerson.display_name}’s work</h4>{data.tasks.filter(t=>t.assignee_id===selected).map(t=><p key={t.id}><strong>{t.title}</strong> · {statusLabel[t.status]} · {day(t.due_date)}</p>)}{data.requirements.filter(r=>r.assignee_id===null||r.assignee_id===selected).map(r=><p key={r.id}><strong>{r.title}</strong> · {statusLabel[requirementState(r,selected!,data.submissions,m.today)]} · {day(r.due_date)}</p>)}</div>}</section>
  </>:<div className="dashboard-columns"><section className="dashboard-panel"><div className="dashboard-section-head"><h3>My tasks</h3><button onClick={()=>onNavigate('work')}>Open my work →</button></div>{m.tasks.slice().sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999')).slice(0,5).map(t=><div className="dashboard-line" key={t.id}><div><strong>{t.title}</strong><p>{day(t.due_date)} · {t.assignee_id?'Assigned to you':'Shared · view only'}</p></div><span className="dashboard-badge">{statusLabel[t.status]}</span></div>)}{!m.tasks.length&&<p>No tasks assigned yet.</p>}</section><section className="dashboard-panel"><div className="dashboard-section-head"><h3>My requirements</h3><button onClick={()=>onNavigate('requirements')}>Submit work →</button></div>{m.requirements.map(r=><div className="dashboard-line" key={r.id}><div><strong>{r.title}</strong><p>{day(r.due_date)}</p></div><span className={`dashboard-badge ${requirementState(r,userId,data.submissions,m.today)==='overdue'?'warning':''}`}>{statusLabel[requirementState(r,userId,data.submissions,m.today)]}</span></div>)}{!m.requirements.length&&<p>No requirements yet.</p>}</section></div>}
  <section className="dashboard-panel"><div className="dashboard-section-head"><h3>Upcoming events</h3><button onClick={()=>onNavigate('calendar')}>Open calendar →</button></div><div className="dashboard-events">{m.events.slice(0,4).map(e=><article key={e.id}><span className="dashboard-badge">{e.event_type||'Event'}</span><h4>{e.title}</h4><p>{new Date(e.starts_at).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} PHT</p><p>{e.location||'Location to follow'}</p></article>)}{!m.events.length&&<p>No upcoming events.</p>}</div></section>
 </div>
}
