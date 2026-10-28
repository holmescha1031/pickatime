const {authorize,ORIGIN}=require('../lib/admin-auth');
const {db,privateKey}=require('../lib/admin-index');
const {valid,encode,decode}=require('../lib/calendar-settings');
const path=()=>`profiles/${privateKey('pickatime:calendar-config:v1')}/meetings`;
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try{
    if(req.method==='GET'){
      if(!['admin','demo'].includes(req.query?.mode))return res.status(200).json({enabled:false,configured:false,clientId:'',reason:'verification_pending'});
      if(!authorize(req,res))return;
      let clientId=valid(process.env.GOOGLE_CLIENT_ID)?process.env.GOOGLE_CLIENT_ID:'';
      try{const saved=decode(await db(path()));if(saved)clientId=saved;}catch{if(!clientId)return res.status(503).json({error:'구글 연결 설정을 확인하지 못했어요. 다시 시도해 주세요.'})}
      return res.status(200).json({enabled:false,testEnabled:req.query?.mode==='demo'&&Boolean(clientId),clientId,configured:Boolean(clientId)});
    }
    if(req.method!=='POST')return res.status(405).json({error:'지원하지 않는 요청입니다.'});
    if(!authorize(req,res))return;
    if(req.headers.origin!==ORIGIN)return res.status(403).json({error:'허용되지 않은 요청입니다.'});
    let body=req.body;try{if(typeof body==='string')body=JSON.parse(body)}catch{return res.status(400).json({error:'올바른 클라이언트 ID를 입력해 주세요.'})}
    if(!valid(body?.clientId))return res.status(400).json({error:'apps.googleusercontent.com으로 끝나는 웹 클라이언트 ID를 입력해 주세요.'});
    await db(path(),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(encode(body.clientId))});
    return res.status(200).json({enabled:false,configured:true,clientId:body.clientId});
  }catch{return res.status(503).json({error:'구글 연결 설정을 저장하지 못했어요. 다시 시도해 주세요.'})}
};
