const crypto=require('node:crypto');
function stableEventId(user,type,id){return crypto.createHash('sha256').update(JSON.stringify([user,type,id])).digest('hex')}
function eventPayload(type,source){
 const base={summary:source.title.slice(0,200),description:'Synced from EIF Compass. Changes in Compass appear after you sync again.'};
 if(type==='requirement'&&!source.due_at){if(!source.due_date)throw new Error('Requirement has no deadline');const end=new Date(`${source.due_date}T00:00:00Z`);end.setUTCDate(end.getUTCDate()+1);return {...base,start:{date:source.due_date},end:{date:end.toISOString().slice(0,10)}}}
 const start=source.due_at||source.starts_at;const timestamp=Date.parse(start);if(!Number.isFinite(timestamp))throw new Error('Invalid event date');
 const end=source.ends_at||new Date(timestamp+(type==='requirement'?30:60)*60000).toISOString();
 if(Date.parse(end)<=timestamp)throw new Error('Invalid event duration');
 return {...base,start:{dateTime:new Date(timestamp).toISOString(),timeZone:'Asia/Manila'},end:{dateTime:new Date(end).toISOString(),timeZone:'Asia/Manila'},...(type==='event'&&!source.ends_at?{description:base.description+' Duration defaults to 60 minutes.'}:{})};
}
module.exports={stableEventId,eventPayload};
