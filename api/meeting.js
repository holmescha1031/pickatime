// Owner-verified physical deletion through a server-only Firebase service account.
const crypto=require('node:crypto');
const DB='https://pickatime-meet-default-rtdb.asia-southeast1.firebasedatabase.app';
const {origins}=require('../lib/site-config');
const validId=id=>typeof id==='string'&&/^m_[a-f0-9]{64}$/.test(id);
function sessionUser(req,secret){
  try{
    const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('wmd_session='))?.slice(12);
    const [payload,signature,...extra]=(cookie||'').split('.');
    if(!payload||!signature||extra.length)return null;
    const expected=crypto.createHmac('sha256',secret).update('pickatime:session:v1:'+payload).digest('base64url');
    const a=Buffer.from(signature),b=Buffer.from(expected);
    if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
    const user=JSON.parse(Buffer.from(payload,'base64url').toString());
    return /^kakao_[0-9]+$/.test(user.id)&&Number.isFinite(user.exp)&&user.exp>Date.now()?user:null;
  }catch{return null;}
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
  const origin=req.headers.origin;
  if(origin&&!origins().has(origin))return res.status(403).json({error:'허용되지 않은 요청입니다.'});
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Credentials','true');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'지원하지 않는 요청입니다.'});
  const secret=process.env.KAKAO_CLIENT_SECRET;
  if(!secret)return res.status(503).json({error:'로그인 서버 설정이 필요합니다.'});
  let body=req.body;
  try{if(typeof body==='string')body=JSON.parse(body);}catch{return res.status(400).json({error:'잘못된 요청입니다.'});}
  const id=req.method==='GET'?req.query?.sid:body?.sid;
  if(!validId(id))return res.status(400).json({error:'잘못된 투표 주소입니다.'});
  const privateKey='u_'+crypto.createHmac('sha256',secret).update('pickatime:deleted-meeting:v1:'+id).digest('hex');
  const marker=`profiles/${privateKey}/meetings/${id}`;
  const db=async(path,options={})=>{
    const r=await fetch(`${DB}/${path}.json`,{...options,signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw Object.assign(new Error('DATABASE_ERROR'),{status:r.status});
    return r.json();
  };
  try{
    if(req.method==='GET')return res.status(200).json({deleted:(await db(marker))===true});
    if(!origin)return res.status(403).json({error:'허용되지 않은 요청입니다.'});
    const user=sessionUser(req,secret);
    if(!user)return res.status(401).json({error:'다시 로그인한 뒤 삭제해 주세요.'});
    if(!['delete','register'].includes(body?.action))return res.status(400).json({error:'잘못된 요청입니다.'});
    const session=await db(`sessions/${id}`);
    const meta=session?.meta;
    if(body.action==='delete'&&!meta&&await db(marker)===true)return res.status(200).json({deleted:true});
    if(!meta||typeof meta.title!=='string')return res.status(404).json({error:'투표를 찾을 수 없습니다.'});
    const ownerId='m_'+crypto.createHash('sha256').update(JSON.stringify([user.id,(meta.originalTitle||meta.title).trim().normalize('NFC')])).digest('hex');
    if(ownerId!==id)return res.status(403).json({error:'투표를 만든 사람만 삭제할 수 있어요.'});
    if(body.action==='register'){
      if(await db(marker)===true)return res.status(409).json({error:'삭제된 투표입니다.'});
      await require('../lib/admin-index').registerMeeting(id);
      return res.status(200).json({indexed:true});
    }
    await require('../lib/firebase-admin-rest').eraseMeeting(id,session,user.id,secret);
    return res.status(200).json({deleted:true});
  }catch(e){if(e.message==='FIREBASE_ADMIN_CONFIG_REQUIRED')return res.status(503).json({error:'DB 실제 삭제를 위한 서버 인증 설정이 필요해요. 아직 삭제되지 않았습니다.'});return res.status(503).json({error:e.status===401||e.status===403?'투표 삭제 정보를 저장할 권한이 없습니다. Firebase 규칙을 확인해 주세요.':'서버 연결에 실패했어요. 잠시 후 다시 시도해 주세요.'});}
};


