const {authorize,ORIGIN}=require('../lib/admin-auth');
const index=require('../lib/admin-index');
const analytics=require('../lib/analytics-config');
const {summarize}=require('../lib/admin-stats');
let cache=new Map();
module.exports=async(req,res)=>{
 const user=authorize(req,res);if(!user)return;
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'지원하지 않는 요청입니다.'});
 try{
  if(req.method==='POST'){
   if(req.headers.origin!==ORIGIN)return res.status(403).json({error:'허용되지 않은 요청입니다.'});
   let body=req.body;try{if(typeof body==='string')body=JSON.parse(body)}catch{return res.status(400).json({error:'올바른 JSON 파일을 선택해 주세요.'})}
   if(body?.action==='ga'){
    if(!analytics.valid(body.measurementId))return res.status(400).json({error:'G-로 시작하는 GA4 측정 ID를 확인해 주세요.'});
    const measurementId=await analytics.setId(body.measurementId);cache.clear();return res.status(200).json({configured:true,measurementId});
   }
   if(body?.action!=='import'||!Array.isArray(body.ids)||!body.ids.length||body.ids.length>2000||!body.ids.every(index.validId))return res.status(400).json({error:'모임 목록 형식을 확인해 주세요. 최대 2,000개까지 한 번에 불러올 수 있어요.'});
   const ids=[...new Set(body.ids)],deadline=Date.now()+40000,result=await index.mapLimit(ids,4,async id=>{if(Date.now()>deadline)throw Error('TIME_BUDGET');const meta=await index.db(`sessions/${id}/meta`);if(!meta)return false;await index.registerMeeting(id);return true});cache.clear();
   if(body.complete===true&&result.every(r=>r.status==='fulfilled'&&r.value))await index.markImported();
   return res.status(200).json({imported:result.filter(r=>r.status==='fulfilled'&&r.value).length,missing:result.filter(r=>r.status==='fulfilled'&&!r.value).length,failed:result.filter(r=>r.status==='rejected').length});
  }
  if(req.query?.mode==='access')return res.status(200).json({authorized:true});
  const days=req.query?.days||'all';if(!['all','7','30','90'].includes(days))return res.status(400).json({error:'조회 기간을 확인해 주세요.'});
  const cacheKey=user.id+':'+days;
  if(req.query?.refresh!=='1'&&cache.get(cacheKey)?.expires>Date.now())return res.status(200).json(cache.get(cacheKey).data);
  const [registered,personal,historicalImported]=await Promise.all([index.meetingIds(),index.personalMeetingIds(user).catch(()=>[]),index.imported()]);
  const ids=[...new Set([...registered,...personal])],deadline=Date.now()+45000,result=await index.mapLimit(ids,4,async id=>{if(Date.now()>deadline)throw Error('TIME_BUDGET');if(await index.deleted(id))return {deleted:true};return {data:await index.db(`sessions/${id}`)}});
  const records=result.filter(r=>r.status==='fulfilled').map(r=>r.value),failed=result.filter(r=>r.status==='rejected').length;
  const measurementId=await analytics.getId();
  const data={...summarize(records,{days}),coverage:{historicalImported,indexed:ids.length,loaded:records.filter(r=>r.data).length,deleted:records.filter(r=>r.deleted).length,failed},ga:{configured:Boolean(measurementId),measurementId}};
  if(!failed)cache.set(cacheKey,{expires:Date.now()+15000,data});return res.status(200).json(data);
 }catch{return res.status(503).json({error:'통계를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'})}
};
