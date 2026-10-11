const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function createRemovalHandler({env=process.env,fetchImpl=fetch}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const fail=(code,error)=>res.status(code).json({error});
  if(req.method!=='DELETE')return fail(405,'Use DELETE.');
  try{
   if(req.headers.origin!==env.APP_URL)return fail(403,'Request origin is not allowed.');
   const token=/^Bearer ([^\s]+)$/i.exec(req.headers.authorization||'')?.[1];if(!token)return fail(401,'Sign in first.');
   const id=req.body?.id;if(!uuid.test(id||''))return fail(400,'Choose a valid requirement.');
   const db=env.SUPABASE_URL?.replace(/\/$/,''),key=env.SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_PUBLISHABLE_KEY,secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
   if(!db||!secret)return fail(503,'Requirement cleanup needs server configuration.');
   const userHeaders={apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:'return=representation'};
   const adminHeaders={apikey:secret,...(!secret.startsWith('sb_secret_')?{Authorization:`Bearer ${secret}`}:{ }),'Content-Type':'application/json'};
   async function request(path,headers,method='GET',body){const r=await fetchImpl(db+path,{method,headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Cleanup could not complete. Retry removal.');return r.status===204?null:r.json()}
   // Privileged cleanup begins only after authentication and cohort-scoped authorization.
   const user=await request('/auth/v1/user',userHeaders);if(!uuid.test(user?.id||''))return fail(401,'Sign in again.');
   const profile=(await request(`/rest/v1/profiles?select=role,cohort_id&id=eq.${user.id}&limit=1`,userHeaders))[0];
   if(profile?.role!=='lead'||!uuid.test(profile.cohort_id||''))return fail(403,'Only your cohort lead can remove requirements.');
   const target=`/rest/v1/requirements?id=eq.${id}&cohort_id=eq.${profile.cohort_id}`;
   const marked=await request(target,userHeaders,'PATCH',{removing:true});if(!marked?.length)return fail(404,'Requirement is unavailable.');
   // Marking locks out new reservations/uploads. Failed cleanup remains retryable.
   const started=Date.now();
   while(true){
    if(Date.now()-started>230000)return fail(503,'Cleanup paused at the time limit. Retry removal to continue.');
    const files=await request(`/rest/v1/submission_files?select=id,object_path&requirement_id=eq.${id}&limit=100`,adminHeaders);
    if(!files.length)break;
    await request('/storage/v1/object/eif-submissions',adminHeaders,'DELETE',{prefixes:files.map(f=>f.object_path)});
    await request(`/rest/v1/submission_files?requirement_id=eq.${id}&id=in.(${files.map(f=>f.id).join(',')})`,adminHeaders,'DELETE');
   }
   const removed=await request(target,userHeaders,'DELETE');if(!removed?.length)return fail(409,'Requirement changed. Refresh and retry.');
   return res.status(200).json({data:removed.map(r=>({id:r.id}))});
  }catch{return fail(502,'Removal is paused. Retry removal to finish cleaning up attachments.');}
 };
}
module.exports={createRemovalHandler};
