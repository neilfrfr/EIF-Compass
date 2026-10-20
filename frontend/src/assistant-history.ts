import type {SupabaseClient} from '@supabase/supabase-js'
import type {View} from './data'
export type Conversation={id:string;generation:number;revision:number}
export type Turn={requestId:string;sequence?:number;question:string;answer:string;generatedAt:string;truncated:boolean;sourceRefs:{id:string;view:View}[];sources:{id:string;title:string;view:View}[]}
export type Unsaved=Turn&{conversationId:string;generation:number;revision:number}
export type Page={conversation:Conversation;turns:Turn[];has_more:boolean;next_before:number|null}
export class HistoryError extends Error{code?:string;constructor(message:string,code?:string){super(message);this.code=code}}
export async function historyRequest(client:SupabaseClient,path:string,method:string,body:unknown,signal:AbortSignal,onDelta?:(text:string)=>void){
 const {data,error}=await client.auth.getSession()
 if(error||!data.session)throw new HistoryError('Your session expired. Sign in again.')
 if(signal.aborted)throw new DOMException('Aborted','AbortError')
 const response=await fetch(path,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},...(body===undefined?{}:{body:JSON.stringify(body)}),signal})
 if(response.ok&&response.headers.get('content-type')?.includes('application/x-ndjson')){
  if(!response.body)throw new HistoryError('The answer stream is unavailable.')
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',complete=false,result
  const line=(value:string)=>{if(!value.trim())return;let event;try{event=JSON.parse(value)}catch{throw new HistoryError('The answer stream was interrupted.')}
   if(event.type==='delta'&&typeof event.text==='string'){onDelta?.(event.text);return}
   if(event.type==='error')throw new HistoryError(event.error||'The answer was interrupted.')
   if(event.type==='complete'&&event.result&&typeof event.result.answer==='string'){result=event.result;complete=true;return}
   throw new HistoryError('The answer stream was invalid.')
  }
  try{while(!complete){if(signal.aborted)throw new DOMException('Aborted','AbortError');const {value,done}=await reader.read();if(done){buffer+=decoder.decode();if(buffer)line(buffer);break}buffer+=decoder.decode(value,{stream:true});if(buffer.length>262144)throw new HistoryError('The answer stream exceeded its limit.');let i;while((i=buffer.indexOf('\n'))>=0){line(buffer.slice(0,i));buffer=buffer.slice(i+1);if(complete)break}}
   if(!complete)throw new HistoryError('The answer was interrupted before saving was confirmed.')
   return result
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 }
 let result
 try{result=await response.json()}catch{throw new HistoryError('Assistant endpoint unavailable. Retry loading history. For local development, also start npm run dev:api.')}
 if(!response.ok)throw new HistoryError(result.error||'Could not access saved history.',result.code)
 return result
}
