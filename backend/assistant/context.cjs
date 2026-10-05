const LIMIT=40;
const clip=(value,max=240)=>typeof value==='string'?value.slice(0,max):value??null;
async function loadContext({request,user,profile,now}){
 const cohort=encodeURIComponent(profile.cohort_id),uid=encodeURIComponent(user.id);
 const read=(table,fields,filter,limit=LIMIT,order='id.asc')=>request(`/rest/v1/${table}?select=${fields}&${filter}&order=${order}&limit=${limit+1}`);
 const [cohorts,people,rawTasks,rawRequirements,rawKnowledge,rawEvents]=await Promise.all([
  read('cohorts','id,name,starts_on,ends_on',`id=eq.${cohort}`,1),
  read('profiles','id,display_name,role,team_name',`cohort_id=eq.${cohort}${profile.role==='intern'?`&id=eq.${uid}`:''}`),
  read('tasks','id,title,description,assignee_id,status,due_date,priority,project_name',`cohort_id=eq.${cohort}`,LIMIT,'due_date.asc.nullslast,id.asc'),
  read('requirements','id,title,description,assignee_id,status,due_date',`cohort_id=eq.${cohort}`,LIMIT,'due_date.asc.nullslast,id.asc'),
  read('ai_knowledge','id,title,content,audience,status,version,updated_at',`cohort_id=eq.${cohort}&status=eq.published&audience=in.(both,${profile.role})`,8,'updated_at.desc,id.asc'),
  read('events','id,title,starts_at,event_type,location',`cohort_id=eq.${cohort}&starts_at=gte.${encodeURIComponent(now.toISOString())}`,20,'starts_at.asc,id.asc'),
 ]);
 const permitted=r=>profile.role==='lead'||r.assignee_id===null||r.assignee_id===user.id;
 const tasks=rawTasks.slice(0,LIMIT).filter(permitted).map(t=>({...t,title:clip(t.title,180),description:clip(t.description),project_name:clip(t.project_name,100)}));
 const requirements=rawRequirements.slice(0,LIMIT).filter(permitted).map(r=>({...r,title:clip(r.title,180),description:clip(r.description)}));
 const submissions=requirements.length?await read('requirement_submissions','requirement_id,user_id,status',`requirement_id=in.(${requirements.map(r=>encodeURIComponent(r.id)).join(',')})${profile.role==='intern'?`&user_id=eq.${uid}`:''}`,160,'requirement_id.asc,user_id.asc'):[];
 const visibleSubmissions=submissions.slice(0,160).filter(s=>profile.role==='lead'||s.user_id===user.id);
 const members=people.slice(0,LIMIT).filter(p=>profile.role==='lead'||p.id===user.id).map(p=>({...p,display_name:clip(p.display_name,100),team_name:clip(p.team_name,100)}));
 const events=rawEvents.slice(0,20).map(e=>({...e,title:clip(e.title,180),location:clip(e.location,120),event_type:clip(e.event_type,100)}));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const state=(r,id)=>visibleSubmissions.find(s=>s.requirement_id===r.id&&s.user_id===id)?.status||r.status;
 const ownTasks=profile.role==='lead'?tasks:tasks.filter(t=>t.assignee_id===user.id);
 const slots=profile.role==='lead'?members.filter(p=>p.role==='intern').flatMap(p=>requirements.filter(r=>r.assignee_id===null||r.assignee_id===p.id).map(r=>({r,id:p.id}))):requirements.map(r=>({r,id:user.id}));
 const summary={overdueTasks:ownTasks.filter(t=>t.status!=='completed'&&t.due_date&&t.due_date<today).length,completedTasks:ownTasks.filter(t=>t.status==='completed').length,assignedTasks:ownTasks.length,overdueRequirements:slots.filter(({r,id})=>!['completed','in_review'].includes(state(r,id))&&r.due_date&&r.due_date<today).length,pendingReviews:visibleSubmissions.filter(s=>s.status==='in_review').length};
 const priorities=[...ownTasks.filter(t=>!['completed','for_review'].includes(t.status)&&t.due_date).map(t=>({id:t.id,title:t.title,date:t.due_date,view:'work'})),...(profile.role==='intern'?requirements.filter(r=>!['completed','in_review'].includes(state(r,user.id))&&r.due_date).map(r=>({id:r.id,title:r.title,date:r.due_date,view:'requirements'})):[])].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const knowledge=rawKnowledge.slice(0,8).filter(k=>k.status==='published'&&['both',profile.role].includes(k.audience)).map(k=>({...k,title:clip(k.title,200),content:clip(k.content,3000)}));
 const truncated=rawKnowledge.length>8||rawKnowledge.some(k=>k.content?.length>3000)||rawTasks.length>LIMIT||rawRequirements.length>LIMIT||people.length>LIMIT||rawEvents.length>20||submissions.length>160;
 const sources=[...tasks.map(t=>({id:t.id,title:t.title,view:'work'})),...requirements.map(r=>({id:r.id,title:r.title,view:'requirements'})),...events.map(e=>({id:e.id,title:e.title,view:'calendar'}))];
 return {knowledge,today,timeZone:'Asia/Manila',role:profile.role,cohort:cohorts[0]?{...cohorts[0],name:clip(cohorts[0].name,100)}:null,members,tasks,requirements,submissions:visibleSubmissions,events,summary,priorities:priorities.slice(0,8),truncated,sources};
}
module.exports={loadContext};
