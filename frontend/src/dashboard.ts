export type ProfileRow={id:string;display_name:string;role:string;team_name?:string|null}
export type TaskRow={id:string;title:string;assignee_id:string|null;status:string;due_date?:string|null;priority?:string;project_name?:string;description?:string}
export type RequirementRow={id:string;title:string;assignee_id:string|null;status:string;due_date?:string|null;description?:string}
export type SubmissionRow={requirement_id:string;user_id:string;status:string;submission_url:string}
export type EventRow={id:string;title:string;starts_at:string;event_type?:string;location?:string}
export type CohortRow={id:string;name:string;starts_on:string|null;ends_on:string|null}
export type DashboardData={cohort:CohortRow;profiles:ProfileRow[];tasks:TaskRow[];requirements:RequirementRow[];submissions:SubmissionRow[];events:EventRow[]}
export function manilaDay(now:Date){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function requirementState(r:RequirementRow,userId:string,submissions:SubmissionRow[],today:string){
 const status=submissions.find(s=>s.requirement_id===r.id&&s.user_id===userId)?.status||r.status
 if(status==='completed'||status==='in_review')return status
 return r.due_date&&r.due_date<today?'overdue':'pending'
}
export function deriveDashboard(data:DashboardData,role:string,userId:string,now=new Date()){
 const today=manilaDay(now)
 const interns=data.profiles.filter(p=>p.role==='intern')
 const tasks=role==='lead'?data.tasks:data.tasks.filter(t=>t.assignee_id===userId||t.assignee_id===null)
 const assignedTasks=role==='lead'?tasks:tasks.filter(t=>t.assignee_id===userId)
 const completedTasks=assignedTasks.filter(t=>t.status==='completed').length
 const taskPercent=assignedTasks.length?Math.round(completedTasks/assignedTasks.length*100):null
 const overdueTasks=assignedTasks.filter(t=>t.status!=='completed'&&t.due_date&&t.due_date<today)
 const requirements=data.requirements.filter(r=>role==='lead'||r.assignee_id===null||r.assignee_id===userId)
 const people=(role==='lead'?interns:interns.filter(p=>p.id===userId)).map(p=>{
  const personal=data.tasks.filter(t=>t.assignee_id===p.id)
  const reqs=data.requirements.filter(r=>r.assignee_id===null||r.assignee_id===p.id)
  return {...p,taskTotal:personal.length,taskDone:personal.filter(t=>t.status==='completed').length,overdueTasks:personal.filter(t=>t.status!=='completed'&&t.due_date&&t.due_date<today).length,requirementTotal:reqs.length,requirementDone:reqs.filter(r=>requirementState(r,p.id,data.submissions,today)==='completed').length,overdueRequirements:reqs.filter(r=>requirementState(r,p.id,data.submissions,today)==='overdue').length}
 })
 const requirementSlots=role==='lead'?people.reduce((n,p)=>n+p.requirementTotal,0):requirements.length
 const completedRequirements=role==='lead'?people.reduce((n,p)=>n+p.requirementDone,0):requirements.filter(r=>requirementState(r,userId,data.submissions,today)==='completed').length
 const overdueRequirements=role==='lead'?people.reduce((n,p)=>n+p.overdueRequirements,0):requirements.filter(r=>requirementState(r,userId,data.submissions,today)==='overdue').length
 const reviewQueue=data.submissions.filter(s=>s.status==='in_review'&&(role==='lead'||s.user_id===userId)).filter(s=>data.requirements.some(r=>r.id===s.requirement_id&&(r.assignee_id===null||r.assignee_id===s.user_id)))
 const teams=[...new Set(interns.map(p=>p.team_name?.trim()).filter((t):t is string=>!!t))].map(name=>{
  const members=people.filter(p=>p.team_name?.trim()===name)
  const total=members.reduce((n,p)=>n+p.taskTotal,0),done=members.reduce((n,p)=>n+p.taskDone,0)
  return {name,members:members.length,total,done,percent:total?Math.round(done/total*100):null}
 })
 const events=data.events.filter(e=>new Date(e.starts_at).getTime()>=now.getTime()).sort((a,b)=>a.starts_at.localeCompare(b.starts_at))
 const actions=[...assignedTasks.filter(t=>t.status!=='completed'&&t.status!=='for_review'&&t.due_date).map(t=>({id:t.id,title:t.title,date:t.due_date!,view:'work' as const,reason:t.due_date!<today?'Overdue task':'Upcoming task deadline'})),...requirements.filter(r=>['pending','overdue'].includes(requirementState(r,userId,data.submissions,today))&&r.due_date).map(r=>({id:r.id,title:r.title,date:r.due_date!,view:'requirements' as const,reason:r.due_date!<today?'Overdue requirement':'Upcoming requirement deadline'}))].sort((a,b)=>a.date.localeCompare(b.date)||(a.view===b.view?0:a.view==='work'?-1:1)||a.id.localeCompare(b.id))
 // Date sorting prioritizes overdue work, then the nearest deadline. No blocker table exists yet.
 const start=data.cohort.starts_on?Date.parse(data.cohort.starts_on):null,end=data.cohort.ends_on?Date.parse(data.cohort.ends_on):null
 const totalWeeks=start!==null&&end!==null?Math.max(1,Math.ceil((end-start+86400000)/604800000)):null
 const week=start!==null?Math.max(0,Math.floor((Date.parse(today)-start)/604800000)+1):null
 return {today,interns,tasks,assignedTasks,completedTasks,taskPercent,overdueTasks,requirements,requirementSlots,completedRequirements,overdueRequirements,reviewQueue,teams,people,events,nextAction:actions[0]||null,week:week!==null&&totalWeeks!==null?Math.min(week,totalWeeks):week,totalWeeks}
}
