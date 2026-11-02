// Kakao identity is verified from the signed HttpOnly cookie, never from the body.
const crypto=require('node:crypto');
const {sessionUser}=require('../lib/admin-auth');
const {origins}=require('../lib/site-config');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
 if(!req.headers.origin||!origins().has(req.headers.origin))return res.status(403).json({error:'허용되지 않은 요청입니다.'});
 res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Access-Control-Allow-Credentials','true');
 res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return res.status(405).json({error:'지원하지 않는 요청입니다.'});
 const user=sessionUser(req);if(!user)return res.status(401).json({error:'다시 로그인해 주세요.'});
 try{
  const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'{}');
  if(account.project_id!=='pickatime-meet'||!account.client_email||!account.private_key)throw Error('CONFIG_REQUIRED');
  const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);
  const payload=encode({alg:'RS256',typ:'JWT'})+'.'+encode({
   iss:account.client_email,sub:account.client_email,
   aud:'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
   iat:now,exp:Math.min(now+3600,Math.floor(user.exp/1000)),uid:user.id
  });
  const token=payload+'.'+crypto.sign('RSA-SHA256',Buffer.from(payload),account.private_key).toString('base64url');
  return res.status(200).json({token,uid:user.id});
 }catch{return res.status(503).json({error:'투표 보호를 위한 Firebase 서버 인증 설정이 필요해요.'});}
};
