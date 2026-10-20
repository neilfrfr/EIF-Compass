function problem(status,message,code){return Object.assign(new Error(message),{status,code})}
async function authenticate(req,{env=process.env,fetchImpl=fetch}={}){
 const token=/^Bearer ([^\s]+)$/i.exec(req.headers.authorization||'')?.[1];
 if(!token)throw problem(401,'Sign in to use the assistant.');
 const url=(env.SUPABASE_URL||env.VITE_SUPABASE_URL||'').replace(/\/$/,'');
 const key=env.SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY;
 if(!url||!key)throw problem(503,'Assistant storage is not configured.');
 const request=async(path,body)=>{
  const response=await fetchImpl(url+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(8000)});
  if(!response.ok){
   const data=await response.json().catch(()=>({}));
   if(path.startsWith('/auth/'))throw problem(401,'Your session expired. Sign in again.');
   if(data.code==='40001')throw problem(409,/generation|scope/.test(data.message||'')?'This conversation was cleared. Reload history.':'The conversation changed. Reload history before retrying.',/generation|scope/.test(data.message||'')?'generation_conflict':'revision_conflict');
   if(['22023','22P02'].includes(data.code))throw problem(400,'Invalid history request.','invalid_request');
   if(data.code==='42501')throw problem(403,'Your account cannot access this conversation.');
   throw problem(503,'Could not access saved history. Retry loading history.','history_unavailable');
  }
  return response.json();
 };
 const user=await request('/auth/v1/user');
 if(!user?.id)throw problem(401,'Your session expired. Sign in again.');
 const profiles=await request(`/rest/v1/profiles?select=id,role,cohort_id,display_name&id=eq.${encodeURIComponent(user.id)}&limit=1`);
 const profile=profiles[0];
 if(!profile||!['intern','lead'].includes(profile.role)||!profile.cohort_id)throw problem(403,'Your account needs a valid fellowship role and cohort.');
 return {request,user,profile};
}
module.exports={authenticate,problem};
