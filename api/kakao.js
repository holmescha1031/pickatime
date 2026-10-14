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
  if (!redirectUri) return res.status(403).json({error:'허용되지 않은 요청입니다.'});
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({error:'POST 요청만 허용합니다.'});
  let body=req.body;
  try { if(typeof body==='string')body=JSON.parse(body); }catch{return res.status(400).json({error:'잘못된 요청입니다.'});}
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
    return res.status(200).json({id:'kakao_'+String(user.id),name:user.kakao_account?.profile?.nickname||user.properties?.nickname||''});
  } catch { return res.status(502).json({error:'카카오 서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.'}); }
};
