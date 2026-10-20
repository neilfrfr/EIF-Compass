const {authenticate,problem}=require('./auth.cjs');
const {uuid,version,pair,store,present}=require('./history-store.cjs');
function createHistoryHandler(options={}){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 try{
  const {request}=await authenticate(req,options),db=store(request);
  let b=req.body||{};if(typeof b==='string'){try{b=JSON.parse(b)}catch{throw problem(400,'Invalid request.')}}
  if(Buffer.byteLength(JSON.stringify(b))>131072)throw problem(413,'Request is too large.');
  if(req.method==='GET'){
   const q=req.query||{},before=q.before===undefined?null:Number(q.before),generation=q.generation===undefined?null:Number(q.generation);
   if((before!==null&&(!Number.isSafeInteger(before)||before<1||generation===null))||(generation!==null&&(!Number.isSafeInteger(generation)||generation<0)))throw problem(400,'Invalid history page.');
   const page=await db.load(before,generation);page.turns=await present(request,page.turns);return res.status(200).json(page);
  }
  if(req.method==='POST'){pair(b);const result=await db.append(b);return res.status(200).json({conversation:result.conversation,turn:(await present(request,[result.turn]))[0]});}
  if(req.method==='DELETE'){version(b);if(!uuid.test(b.conversationId||b.id))throw problem(400,'Invalid conversation.');return res.status(200).json({conversation:await db.clear(b)});}
  res.setHeader('Allow','GET, POST, DELETE');throw problem(405,'Use GET, POST or DELETE.');
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Could not access saved history. Retry loading history.',code:e.code||'history_unavailable'});}
}}
module.exports={createHistoryHandler};
