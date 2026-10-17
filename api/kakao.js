// Vercel Node.js Function. Secrets belong in Environment Variables, never in GitHub.
module.exports = async function handler(req, res) {
  const callbacks = new Map([
    ['https://pickatime-phi.vercel.app', 'https://pickatime-phi.vercel.app/'],
    ['https://holmescha1031.github.io', 'https://holmescha1031.github.io/pickatime/']
  ]);
  const origin = req.headers.origin;
  const redirectUri = callbacks.get(origin);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');
  if (!redirectUri && !(req.method === 'GET' && !origin)) return res.status(403).json({error:'허용되지 않은 요청입니다.'});
  if(origin)res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const crypto=require('node:crypto');
  const sessionSecret=process.env.KAKAO_CLIENT_SECRET;
  const sign=value=>crypto.createHmac('sha256',sessionSecret).update('pickatime:session:v1:'+value).digest('base64url');
  const setCookie=(value,age)=>res.setHeader('Set-Cookie',`wmd_session=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`);
  if(req.method==='GET'){
    if(!sessionSecret)return res.status(503).json({error:'로그인 설정이 필요합니다.'});
    try{
      const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('wmd_session='))?.slice(12);
      const [payload,signature,...extra]=(cookie||'').split('.');
      if(!payload||!signature||extra.length)throw new Error();
      const expected=Buffer.from(sign(payload)),actual=Buffer.from(signature);
      if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))throw new Error();
      const user=JSON.parse(Buffer.from(payload,'base64url').toString());
      if(!Number.isFinite(user.exp)||user.exp<=Date.now())throw new Error();
      return res.status(200).json({id:user.id,name:user.name,profileKey:user.profileKey});
    }catch{return res.status(401).json({error:'로그인이 필요합니다.'});}
  }
  if (req.method !== 'POST') return res.status(405).json({error:'POST 요청만 허용합니다.'});
  let body=req.body;
  try { if(typeof body==='string')body=JSON.parse(body); }catch{return res.status(400).json({error:'잘못된 요청입니다.'});}
  if(body?.action==='logout'){setCookie('',0);return res.status(200).json({ok:true});}
  if (!body || typeof body.code !== 'string' || body.code.length>2048 || !body.code || body.redirectUri!==redirectUri)
    return res.status(400).json({error:'로그인 코드 또는 콜백 주소가 잘못됐습니다.'});
  const key=process.env.KAKAO_REST_API_KEY;
  const secret=process.env.KAKAO_CLIENT_SECRET;
  if(!key || !secret) return res.status(503).json({error:'Vercel에 카카오 REST API 키와 Client Secret을 설정해 주세요.'});
  try {
    const params=new URLSearchParams({grant_type:'authorization_code',client_id:key,client_secret:secret,
      redirect_uri:redirectUri,code:body.code});
    const response=await fetch('https://kauth.kakao.com/oauth/token',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params,
      signal:AbortSignal.timeout(10000)});
    const token=await response.json();
    if(!response.ok || !token.access_token) return res.status(401).json({error:'카카오 토큰 발급 실패. 키·시크릿·Redirect URI를 확인하고 다시 로그인해 주세요.'});
    const result=await fetch('https://kapi.kakao.com/v2/user/me',{
      headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(10000)});
    const user=await result.json();
    if(!result.ok || user.id==null)return res.status(401).json({error:'카카오 회원 조회에 실패했습니다.'});
    const profileKey='u_'+require('node:crypto').createHmac('sha256',secret)
      .update('pickatime:profile:v1:'+String(user.id)).digest('hex');
    const account={id:'kakao_'+String(user.id),profileKey,name:user.kakao_account?.profile?.nickname||user.properties?.nickname||''};
    const payload=Buffer.from(JSON.stringify({...account,exp:Date.now()+30*24*60*60*1000})).toString('base64url');
    setCookie(payload+'.'+sign(payload),30*24*60*60);
    return res.status(200).json(account);
  } catch { return res.status(502).json({error:'카카오 서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.'}); }
};
