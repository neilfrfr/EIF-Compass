import type {SupabaseClient} from '@supabase/supabase-js'
import type {View} from './data'
export type Conversation={id:string;generation:number;revision:number}
export type Turn={requestId:string;sequence?:number;question:string;answer:string;generatedAt:string;truncated:boolean;sourceRefs:{id:string;view:View}[];sources:{id:string;title:string;view:View}[]}
export type Unsaved=Turn&{conversationId:string;generation:number;revision:number}
export type Page={conversation:Conversation;turns:Turn[];has_more:boolean;next_before:number|null}
export class HistoryError extends Error{code?:string;constructor(message:string,code?:string){super(message);this.code=code}}
export async function historyRequest(client:SupabaseClient,path:string,method:string,body:unknown,signal:AbortSignal){
 const {data,error}=await client.auth.getSession()
 if(error||!data.session)throw new HistoryError('Your session expired. Sign in again.')
 if(signal.aborted)throw new DOMException('Aborted','AbortError')
 const response=await fetch(path,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},...(body===undefined?{}:{body:JSON.stringify(body)}),signal})
 let result
 try{result=await response.json()}catch{throw new HistoryError('Assistant endpoint unavailable. Retry loading history. For local development, also start npm run dev:api.')}
 if(!response.ok)throw new HistoryError(result.error||'Could not access saved history.',result.code)
 return result
}
