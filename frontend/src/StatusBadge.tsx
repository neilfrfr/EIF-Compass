import type {ReactNode} from 'react'

export type Status='overdue'|'pending'|'upcoming'|'in_review'|'completed'|'to_do'|'in_progress'|'for_review'|'open'
export const statusLabel:Record<string,string>={completed:'Completed',in_review:'Under review',upcoming:'Upcoming',pending:'Pending',overdue:'Overdue',to_do:'To do',in_progress:'In progress',for_review:'For review',open:'Open'}

const ring=<circle cx="8" cy="8" r="5.5"/>
const eye=<><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/></>
const alert=<><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5M8 10.75v.25"/></>
const half=<>{ring}<path d="M8 2.5a5.5 5.5 0 0 1 0 11Z" fill="currentColor" stroke="none"/></>
const icons:Record<string,ReactNode>={
  overdue:alert,open:alert,pending:half,in_progress:half,upcoming:ring,in_review:eye,for_review:eye,
  completed:<path d="M3 8.5 6.5 12 13 4.5"/>,
  to_do:<circle cx="8" cy="8" r="5.5" strokeDasharray="2.6 2"/>,
}

/** Status pill that always pairs an icon with its text label; colour only adds meaning. */
export default function StatusBadge({status,detail}:{status:Status|(string&{});detail?:string}){
  return <span className={`status-badge is-${status}`}>
    <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{icons[status]??ring}</svg>
    {statusLabel[status]??status}{detail?` · ${detail}`:''}
  </span>
}
