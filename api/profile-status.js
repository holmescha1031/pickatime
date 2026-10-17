// Read-only check of the deployed Firebase profile access rules. No account data is returned.
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const path='profiles/u_'+'0'.repeat(64)+'.json';
    const r=await fetch('https://pickatime-meet-default-rtdb.asia-southeast1.firebasedatabase.app/'+path,{signal:AbortSignal.timeout(8000)});
    if(r.ok)return res.status(200).json({profilesReadable:true});
    return res.status(200).json({profilesReadable:false,reason:r.status===401||r.status===403?'PERMISSION_DENIED':'DATABASE_HTTP_'+r.status});
  }catch{return res.status(200).json({profilesReadable:false,reason:'DATABASE_UNREACHABLE'});}
};
