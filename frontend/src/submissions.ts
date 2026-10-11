export type SubmissionRequirement={id?:string;due_date?:string|null;due_at?:string|null;removing?:boolean}
export type SubmissionRow={requirement_id:string;user_id:string;submission_url?:string|null;links?:string[];note?:string;status:string;reviewed_at?:string|null}
export function submissionCutoff(r:SubmissionRequirement){
 if(r.due_at)return new Date(r.due_at).toISOString()
 if(!r.due_date)return null
 return new Date(Date.parse(`${r.due_date}T00:00:00+08:00`)+86400000).toISOString()
}
export function canEditSubmission(r:SubmissionRequirement,s:{status:string}|null|undefined,now=new Date()){
 const cutoff=submissionCutoff(r)
 return !r.removing&&(!cutoff||now.getTime()<Date.parse(cutoff))&&!['completed','in_review'].includes(s?.status||'')
}
export const fileTypes:Record<string,string[]>={pdf:['application/pdf'],doc:['application/msword'],docx:['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],xls:['application/vnd.ms-excel'],xlsx:['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],ppt:['application/vnd.ms-powerpoint'],pptx:['application/vnd.openxmlformats-officedocument.presentationml.presentation'],txt:['text/plain'],png:['image/png'],jpg:['image/jpeg'],jpeg:['image/jpeg']}
export function validateAttachment(file:{name:string;type:string;size:number}){
 const ext=file.name.split('.').pop()?.toLowerCase()||''
 if(!fileTypes[ext]?.includes(file.type))return 'Choose a PDF, Office document, text file, PNG or JPEG with a matching file type.'
 if(file.size<1||file.size>10*1024*1024)return 'Each file must be nonempty and no larger than 10 MiB.'
 return null
}
export function submissionLinks(s:SubmissionRow){return [...new Set([s.submission_url,...(s.links||[])].filter((v):v is string=>!!v))]}
export function validSubmissionLink(value:string){try{return !/\s/.test(value)&&['http:','https:'].includes(new URL(value).protocol)}catch{return false}}
