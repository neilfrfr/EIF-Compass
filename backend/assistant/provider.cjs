const {problem}=require('./auth.cjs');
const empty=reason=>problem(502,reason==='length'?'The model reached its token limit before producing a complete answer. Try a shorter question.':reason==='content_filter'?'The model blocked this response. Try rephrasing your question.':'The model returned no answer text. Retry once, or select another model in OpenRouter.');
async function generateAnswer({env,fetchImpl,messages,signal,stream,onDelta}){
 const response=await fetchImpl('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${env.OPENROUTER_API_KEY}`,'Content-Type':'application/json','X-Title':'EIF Compass'},body:JSON.stringify({model:env.OPENROUTER_MODEL,messages,max_tokens:1200,reasoning:{enabled:false},temperature:0.3,...(stream?{stream:true}:{})}),signal});
 if(!response.ok)throw problem(503,'The AI provider is unavailable or its usage limit was reached. Please try again later.');
 if(!stream){const data=await response.json(),choice=data.choices?.[0],content=choice?.message?.content;const answer=typeof content==='string'?content:Array.isArray(content)?content.filter(p=>p?.type==='text'&&typeof p.text==='string').map(p=>p.text).join('\n'):'';if(!answer.trim()||(choice?.finish_reason&&choice.finish_reason!=='stop'))throw empty(choice?.finish_reason);if(answer.length>16000)throw problem(502,'The answer exceeded its limit and was not saved.');return answer}
 if(!response.body||!response.headers.get('content-type')?.includes('text/event-stream'))throw problem(502,'The provider did not return a stream. Retry or select a streaming model.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',answer='',finish=null,dataLines=[],doneEvent=false;
 const event=()=>{
  if(!dataLines.length)return;const raw=dataLines.join('\n');dataLines=[];
  if(raw==='[DONE]'){doneEvent=true;return}
  let frame;try{frame=JSON.parse(raw)}catch{throw problem(502,'The AI stream was interrupted. The partial answer was not saved.')}
  if(frame.error)throw problem(502,'The AI provider interrupted the answer. The partial answer was not saved.');
  const c=frame.choices?.[0];if(c?.finish_reason)finish=c.finish_reason;
  const delta=c?.delta?.content;if(typeof delta==='string'&&delta){if(answer.length+delta.length>16000)throw problem(502,'The answer exceeded its limit. The partial answer was not saved.');answer+=delta;onDelta(delta)}
 };
 const line=l=>{if(l==='')event();else if(l.startsWith('data:'))dataLines.push(l.slice(5).replace(/^ /,''))};
 try{
  while(!doneEvent){if(signal.aborted)throw signal.reason;const {value,done}=await reader.read();if(done){buffer+=decoder.decode();if(buffer){line(buffer.replace(/\r$/,''));buffer=''}event();break}buffer+=decoder.decode(value,{stream:true});if(buffer.length>65536)throw problem(502,'The AI stream exceeded its limit.');let i;while((i=buffer.indexOf('\n'))>=0){line(buffer.slice(0,i).replace(/\r$/,''));buffer=buffer.slice(i+1);if(doneEvent)break}}
  if(!doneEvent||finish!=='stop'||!answer.trim())throw empty(finish);
  return answer;
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
module.exports={generateAnswer};
