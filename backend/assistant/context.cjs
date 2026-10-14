const LIMIT=40;
const clip=(value,max=240)=>typeof value==='string'?value.slice(0,max):value??null;
async function loadContext({request,user,profile,now}){
 const {deadlineInstant,rankActions,requirementState}=await import('../../shared/workflow-rules.mjs');
 const cohort=encodeURIComponent(profile.cohort_id),uid=encodeURIComponent(user.id);
 const read=(table,fields,filter,limit=LIMIT,order='id.asc')=>request(`/rest/v1/${table}?select=${fields}&${filter}&order=${order}&limit=${limit+1}`);
 const [cohorts,people,rawTasks,rawRequirements,rawEvents,rawProjects,rawSprints,rawMilestones,rawBlockers,rawFeedback,rawTeams,rawMemberships]=await Promise.all([
  read('cohorts','id,name,starts_on,ends_on',`id=eq.${cohort}`,1),
  read('profiles','id,display_name,role,team_name',`cohort_id=eq.${cohort}`),
  read('tasks','id,title,description,assignee_id,status,due_date,priority,project_name,project_id,sprint_id,milestone_id',`cohort_id=eq.${cohort}`,LIMIT,'due_date.asc.nullslast,id.asc'),
  read('requirements','id,title,description,assignee_id,status,due_date,due_at,removing',`cohort_id=eq.${cohort}`,LIMIT,'due_date.asc.nullslast,id.asc'),
  read('events','id,title,starts_at,event_type,location',`cohort_id=eq.${cohort}&starts_at=gte.${encodeURIComponent(now.toISOString())}`,20,'starts_at.asc,id.asc'),
  read('projects','id,title,description,team_id',`cohort_id=eq.${cohort}`),
  read('sprints','id,project_id,title,sequence,starts_on,ends_on',`cohort_id=eq.${cohort}`),
  read('milestones','id,project_id,sprint_id,title,due_date,status',`cohort_id=eq.${cohort}`),
  read('blockers','id,reporter_id,project_id,milestone_id,category,description,status,created_at',`cohort_id=eq.${cohort}`,LIMIT,'created_at.asc,id.asc'),
  read('sprint_feedback','id,project_id,sprint_id,author_id,body,created_at',`cohort_id=eq.${cohort}`,LIMIT,'created_at.desc,id.asc'),
  read('teams','id,name',`cohort_id=eq.${cohort}`),
  read('team_memberships','team_id,user_id',`cohort_id=eq.${cohort}`,160,'team_id.asc,user_id.asc'),
 ]);
 const teams=rawTeams.slice(0,LIMIT).map(t=>({...t,name:clip(t.name,100)}));
 const teamIds=new Set(teams.map(t=>t.id));
 const memberships=rawMemberships.slice(0,160).filter(m=>teamIds.has(m.team_id));
 const teammateIds=new Set(memberships.map(m=>m.user_id));
 const projects=rawProjects.slice(0,LIMIT).map(p=>({...p,title:clip(p.title,180),description:clip(p.description)}));
 const projectIds=new Set(projects.map(p=>p.id));
 const sprints=rawSprints.slice(0,LIMIT).filter(s=>projectIds.has(s.project_id)).map(s=>({...s,title:clip(s.title,180)}));
 const milestones=rawMilestones.slice(0,LIMIT).filter(m=>projectIds.has(m.project_id)).map(m=>({...m,title:clip(m.title,180)}));
 const blockers=rawBlockers.slice(0,LIMIT).filter(b=>profile.role==='lead'||b.reporter_id===user.id).map(b=>({...b,description:clip(b.description)}));
 const permitted=r=>profile.role==='lead'||r.assignee_id===null||r.assignee_id===user.id;
 const tasks=rawTasks.slice(0,LIMIT).filter(t=>profile.role==='lead'||(t.project_id?projectIds.has(t.project_id):permitted(t))).map(t=>({...t,title:clip(t.title,180),description:clip(t.description),project_name:clip(t.project_name,100)}));
 const requirements=rawRequirements.slice(0,LIMIT).filter(permitted).map(r=>({...r,title:clip(r.title,180),description:clip(r.description)}));
 const submissions=requirements.length?await read('requirement_submissions','requirement_id,user_id,status',`requirement_id=in.(${requirements.map(r=>encodeURIComponent(r.id)).join(',')})${profile.role==='intern'?`&user_id=eq.${uid}`:''}`,160,'requirement_id.asc,user_id.asc'):[];
 const visibleSubmissions=submissions.slice(0,160).filter(s=>profile.role==='lead'||s.user_id===user.id);
 const members=people.slice(0,LIMIT).filter(p=>profile.role==='lead'||p.id===user.id||teammateIds.has(p.id)).map(p=>({...p,display_name:clip(p.display_name,100),team_name:clip(p.team_name,100)}));
 const events=rawEvents.slice(0,20).map(e=>({...e,title:clip(e.title,180),location:clip(e.location,120),event_type:clip(e.event_type,100)}));
 // The caller's JWT and sprint_feedback RLS decide which project feedback is permitted.
 const feedback=rawFeedback.slice(0,LIMIT).map(f=>({...f,body:clip(f.body,1000)}));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const ownTasks=profile.role==='lead'?tasks:tasks.filter(t=>t.assignee_id===user.id);
 const slots=profile.role==='lead'?members.filter(p=>p.role==='intern').flatMap(p=>requirements.filter(r=>r.assignee_id===null||r.assignee_id===p.id).map(r=>({r,id:p.id}))):requirements.map(r=>({r,id:user.id}));
 const summary={overdueTasks:ownTasks.filter(t=>t.status!=='completed'&&deadlineInstant(t)&&Date.parse(deadlineInstant(t))<=now.getTime()).length,completedTasks:ownTasks.filter(t=>t.status==='completed').length,assignedTasks:ownTasks.length,overdueRequirements:slots.filter(({r,id})=>requirementState(r,id,visibleSubmissions,now)==='overdue').length,pendingReviews:visibleSubmissions.filter(s=>s.status==='in_review').length};
 const priorities=rankActions({tasks:ownTasks,requirements,submissions:visibleSubmissions,blockers,milestones,role:profile.role,userId:user.id},now);
 const truncated=rawTasks.length>LIMIT||rawRequirements.length>LIMIT||people.length>LIMIT||rawEvents.length>20||rawFeedback.length>LIMIT||[rawProjects,rawSprints,rawMilestones,rawBlockers,rawTeams].some(rows=>rows.length>LIMIT)||submissions.length>160||rawMemberships.length>160;
 const sources=[...tasks.map(t=>({id:t.id,title:t.title,view:'work'})),...requirements.map(r=>({id:r.id,title:r.title,view:'requirements'})),...events.map(e=>({id:e.id,title:e.title,view:'calendar'})),...projects.map(p=>({id:p.id,title:p.title,view:'projects'})),...blockers.map(b=>({id:b.id,title:'Blocker',view:'blockers'})),...feedback.map(f=>({id:f.id,title:'Sprint feedback',view:'feedback'}))];
 return {today,timeZone:'Asia/Manila',role:profile.role,cohort:cohorts[0]?{...cohorts[0],name:clip(cohorts[0].name,100)}:null,members,tasks,requirements,submissions:visibleSubmissions,events,feedback,teams,memberships,projects,sprints,milestones,blockers,summary,priorities:priorities.slice(0,8),truncated,sources};
}
module.exports={loadContext};
