// Shared browser/server rules. Date-only submission cutoffs are exclusive Manila midnight.
export function manilaDay(now){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now))}
export function deadlineInstant(record){if(record.due_at){const value=Date.parse(record.due_at);return Number.isFinite(value)?new Date(value).toISOString():null}if(!record.due_date)return null;const value=Date.parse(`${record.due_date}T00:00:00+08:00`);return Number.isFinite(value)?new Date(value+86400000).toISOString():null}
export function requirementState(record,userId,submissions,now){const status=submissions.find(s=>s.requirement_id===record.id&&s.user_id===userId)?.status||record.status;if(['completed','in_review'].includes(status))return status;const cutoff=deadlineInstant(record);return cutoff&&Date.parse(cutoff)<=new Date(now).getTime()?'overdue':'pending'}
export function compareInstants(a,b){return Date.parse(a.at)-Date.parse(b.at)||String(a.kind||'').localeCompare(String(b.kind||''))||a.id.localeCompare(b.id)}
export function rankActions({tasks,requirements,submissions,blockers=[],milestones=[],role,userId},now){
 const instant=new Date(now).getTime();
 const action=(record,view,reason)=>{const dueAt=deadlineInstant(record);return {id:record.id,title:record.title,date:record.due_at?manilaDay(dueAt):record.due_date,view,reason,dueAt,exact:!!record.due_at}};
 const taskActions=tasks.filter(t=>(role==='lead'||t.assignee_id===userId)&&!['completed','for_review'].includes(t.status)&&deadlineInstant(t)).map(t=>action(t,'work',Date.parse(deadlineInstant(t))<=instant?'Overdue task':'Nearest task deadline'));
 const requirementActions=role==='intern'?requirements.filter(r=>(r.assignee_id===null||r.assignee_id===userId)&&!r.removing&&requirementState(r,userId,submissions,now)==='pending'&&deadlineInstant(r)&&Date.parse(deadlineInstant(r))>instant).map(r=>action(r,'requirements','Nearest requirement deadline')):[];
 const dated=[...taskActions,...requirementActions].sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt)||(a.view===b.view?0:a.view==='work'?-1:1)||a.id.localeCompare(b.id));
 const blocked=blockers.filter(b=>b.status==='open'&&(role==='lead'||b.reporter_id===userId)).map(b=>({blocker:b,milestone:milestones.find(m=>m.id===b.milestone_id&&m.status!=='completed')})).filter(x=>x.milestone).sort((a,b)=>(a.milestone.due_date||'9999').localeCompare(b.milestone.due_date||'9999')||a.blocker.id.localeCompare(b.blocker.id));
 if(blocked[0]){const {blocker,milestone}=blocked[0];dated.push({id:blocker.id,title:milestone.title,date:milestone.due_date||null,dueAt:deadlineInstant(milestone),view:'blockers',exact:false,reason:`Open blocker: ${blocker.description}`})}return dated;
}
