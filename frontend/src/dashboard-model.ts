import {deadlineInstant,rankActions,manilaDay,requirementState as sharedRequirementState} from '../../shared/workflow-rules.mjs'
export type ProfileRow={id:string;display_name:string;role:string;team_name?:string|null}
export type TaskRow={id:string;title:string;assignee_id:string|null;status:string;due_date?:string|null;priority?:string;project_name?:string;description?:string}
export type RequirementRow={id:string;title:string;assignee_id:string|null;status:string;due_date?:string|null;due_at?:string|null;removing?:boolean;description?:string}
export type SubmissionRow={requirement_id:string;user_id:string;status:string;submission_url:string}
export type EventRow={id:string;title:string;starts_at:string;event_type?:string;location?:string}
export type CohortRow={id:string;name:string;starts_on:string|null;ends_on:string|null}
export type BlockerRow={id:string;reporter_id:string;project_id?:string|null;milestone_id?:string|null;status:string;description:string;created_at?:string}
export type MilestoneRow={id:string;title:string;project_id:string;status:string;due_date?:string|null}
export type ProjectRow={id:string;title:string;team_id:string}
export type TeamRow={id:string;name:string}
export type MembershipRow={team_id:string;user_id:string}
export type DashboardData={cohort:CohortRow;profiles:ProfileRow[];tasks:TaskRow[];requirements:RequirementRow[];submissions:SubmissionRow[];events:EventRow[];blockers?:BlockerRow[];milestones?:MilestoneRow[];projects?:ProjectRow[];projectTeams?:TeamRow[];memberships?:MembershipRow[]}
export {manilaDay}
export function requirementState(r:RequirementRow,userId:string,submissions:SubmissionRow[],now:Date|string){return sharedRequirementState(r,userId,submissions,typeof now==='string'&&now.length===10?`${now}T00:00:00+08:00`:now)}
export function deriveDashboard(data:DashboardData,role:string,userId:string,now=new Date()){
 const today=manilaDay(now)
 const interns=data.profiles.filter(p=>p.role==='intern')
 const tasks=role==='lead'?data.tasks:data.tasks.filter(t=>t.assignee_id===userId||t.assignee_id===null)
 const assignedTasks=role==='lead'?tasks:tasks.filter(t=>t.assignee_id===userId)
 const completedTasks=assignedTasks.filter(t=>t.status==='completed').length
 const taskPercent=assignedTasks.length?Math.round(completedTasks/assignedTasks.length*100):null
 const overdueTasks=assignedTasks.filter(t=>t.status!=='completed'&&deadlineInstant(t)&&Date.parse(deadlineInstant(t)!)<=now.getTime())
 const requirements=data.requirements.filter(r=>role==='lead'||r.assignee_id===null||r.assignee_id===userId)
 const people=(role==='lead'?interns:interns.filter(p=>p.id===userId)).map(p=>{
  const personal=data.tasks.filter(t=>t.assignee_id===p.id)
  const reqs=data.requirements.filter(r=>r.assignee_id===null||r.assignee_id===p.id)
  const linkedTeam=(data.projectTeams||[]).find(team=>(data.memberships||[]).some(m=>m.team_id===team.id&&m.user_id===p.id))
  return {...p,team_name:linkedTeam?.name||p.team_name,taskTotal:personal.length,taskDone:personal.filter(t=>t.status==='completed').length,overdueTasks:personal.filter(t=>t.status!=='completed'&&deadlineInstant(t)&&Date.parse(deadlineInstant(t)!)<=now.getTime()).length,requirementTotal:reqs.length,requirementDone:reqs.filter(r=>requirementState(r,p.id,data.submissions,now)==='completed').length,overdueRequirements:reqs.filter(r=>requirementState(r,p.id,data.submissions,now)==='overdue').length}
 })
 const requirementSlots=role==='lead'?people.reduce((n,p)=>n+p.requirementTotal,0):requirements.length
 const completedRequirements=role==='lead'?people.reduce((n,p)=>n+p.requirementDone,0):requirements.filter(r=>requirementState(r,userId,data.submissions,now)==='completed').length
 const overdueRequirements=role==='lead'?people.reduce((n,p)=>n+p.overdueRequirements,0):requirements.filter(r=>requirementState(r,userId,data.submissions,now)==='overdue').length
 const reviewQueue=data.submissions.filter(s=>s.status==='in_review'&&(role==='lead'||s.user_id===userId)).filter(s=>data.requirements.some(r=>r.id===s.requirement_id&&(r.assignee_id===null||r.assignee_id===s.user_id)))
 const teamNames=(data.projectTeams?.length?data.projectTeams.map(t=>t.name):interns.map(p=>p.team_name?.trim()).filter((t):t is string=>!!t))
 const teams=[...new Set(teamNames)].map(name=>{
  const members=people.filter(p=>p.team_name?.trim()===name)
  const total=members.reduce((n,p)=>n+p.taskTotal,0),done=members.reduce((n,p)=>n+p.taskDone,0)
  return {name,members:members.length,total,done,percent:total?Math.round(done/total*100):null}
 })
 const events=data.events.filter(e=>new Date(e.starts_at).getTime()>=now.getTime()).sort((a,b)=>a.starts_at.localeCompare(b.starts_at))
 const blockers=(data.blockers||[]).filter(b=>role==='lead'||b.reporter_id===userId)
 const openBlockers=blockers.filter(b=>b.status==='open').sort((a,b)=>(a.created_at||'').localeCompare(b.created_at||'')||a.id.localeCompare(b.id))
 const nextAction=rankActions({tasks:assignedTasks,requirements,submissions:data.submissions,blockers:openBlockers,milestones:data.milestones||[],role,userId},now)[0]||null
 const start=data.cohort.starts_on?Date.parse(data.cohort.starts_on):null,end=data.cohort.ends_on?Date.parse(data.cohort.ends_on):null
 const totalWeeks=start!==null&&end!==null?Math.max(1,Math.ceil((end-start+86400000)/604800000)):null
 const week=start!==null?Math.max(0,Math.floor((Date.parse(today)-start)/604800000)+1):null
 return {today,now,interns,tasks,assignedTasks,completedTasks,taskPercent,overdueTasks,requirements,requirementSlots,completedRequirements,overdueRequirements,reviewQueue,teams,people,events,blockers,openBlockers,nextAction,week:week!==null&&totalWeeks!==null?Math.min(week,totalWeeks):week,totalWeeks}
}
