const {getId}=require('../lib/analytics-config');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'지원하지 않는 요청입니다.'});
 try{return res.status(200).json({measurementId:await getId()})}catch{return res.status(503).json({measurementId:''})}
};
