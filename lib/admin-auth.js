const crypto=require('node:crypto');
const settings=require('./admin-settings');
const ORIGIN='https://pickatime-phi.vercel.app';
function sessionUser(req){
 const secret=process.env.KAKAO_CLIENT_SECRET;if(!secret)return null;
 try{
  const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('wmd_session='))?.slice(12);
  const [payload,signature,...extra]=(cookie||'').split('.');if(!payload||!signature||extra.length)return null;
  const expected=crypto.createHmac('sha256',secret).update('pickatime:session:v1:'+payload).digest('base64url');
  const a=Buffer.from(signature),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
  const user=JSON.parse(Buffer.from(payload,'base64url').toString());
  return /^kakao_[0-9]+$/.test(user.id)&&Number.isFinite(user.exp)&&user.exp>Date.now()?user:null;
 }catch{return null}
}
function adminIds(){return (settings.adminIds||[]).filter(id=>/^kakao_[0-9]+$/.test(id))}
function gaId(){const id=process.env.GA_MEASUREMENT_ID||settings.gaMeasurementId;return /^G-[A-Z0-9]{5,20}$/.test(id||'')?id:''}
function authorize(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.headers.origin&&req.headers.origin!==ORIGIN){res.status(403).json({error:'허용되지 않은 요청입니다.'});return null}
 const user=sessionUser(req);if(!user){res.status(401).json({error:'카카오 로그인이 필요합니다.'});return null}
 const allowed=adminIds(),hashes=settings.adminHashes||[];if(!allowed.length&&!hashes.length){res.status(503).json({error:'관리자 계정이 아직 설정되지 않았어요.',accountId:user.id});return null}
 if(!allowed.includes(user.id)&&!hashes.includes(crypto.createHash('sha256').update(user.id).digest('hex'))){res.status(403).json({error:'관리자만 볼 수 있는 화면입니다.',accountId:user.id});return null}
 return user;
}
module.exports={sessionUser,authorize,gaId,ORIGIN};
