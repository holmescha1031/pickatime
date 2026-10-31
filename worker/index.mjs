import kakao from '../api/kakao.js';
import meeting from '../api/meeting.js';
import firebaseToken from '../api/firebase-token.js';
import admin from '../api/admin.js';
import calendar from '../api/calendar-config.js';
import analytics from '../api/analytics-config.js';
import profileStatus from '../api/profile-status.js';
const handlers={'/api/kakao':kakao,'/api/meeting':meeting,'/api/firebase-token':firebaseToken,'/api/admin':admin,'/api/calendar-config':calendar,'/api/analytics-config':analytics,'/api/profile-status':profileStatus};
const security={
 'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy':"frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
 'Strict-Transport-Security':'max-age=15552000'
};
function protect(response){const headers=new Headers(response.headers);for(const [k,v]of Object.entries(security))headers.set(k,v);return new Response(response.body,{status:response.status,headers});}
async function readBody(request){
 const limit=256*1024;
 if(Number(request.headers.get('content-length'))>limit)throw Error('BODY_TOO_LARGE');
 if(!request.body)return undefined;
 const reader=request.body.getReader();let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('BODY_TOO_LARGE');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 const text=new TextDecoder().decode(bytes);if(!text)return undefined;
 try{return JSON.parse(text);}catch{throw Error('INVALID_JSON');}
}
export async function invoke(handler,request){
 const url=new URL(request.url),headers=new Headers({'Cache-Control':'private, no-store'});
 let status=200,response;
 const res={setHeader(k,v){headers.set(k,String(v));return this},status(s){status=s;return this},json(value){headers.set('Content-Type','application/json; charset=utf-8');response=new Response(JSON.stringify(value),{status,headers});return this},end(){response=new Response(null,{status,headers});return this}};
 try{
  const body=['GET','HEAD','OPTIONS'].includes(request.method)?undefined:await readBody(request);
  await handler({method:request.method,headers:Object.fromEntries(request.headers),query:Object.fromEntries(url.searchParams),body},res);
  return response||Response.json({error:'서버 응답 오류입니다.'},{status:500,headers});
 }catch(e){return Response.json({error:e.message==='BODY_TOO_LARGE'?'요청이 너무 큽니다.':e.message==='INVALID_JSON'?'잘못된 요청입니다.':'서버 설정이나 연결을 확인해 주세요.'},{status:e.message==='BODY_TOO_LARGE'?413:e.message==='INVALID_JSON'?400:503,headers});}
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/')){
   const handler=handlers[url.pathname];
   const result=handler?await invoke(handler,request):Response.json({error:'NOT_FOUND'},{status:404,headers:{'Cache-Control':'no-store'}});
   return protect(result);
  }
  if(!['GET','HEAD'].includes(request.method))return protect(new Response('Method Not Allowed',{status:405}));
  // These routes run before the asset handler; the remaining assets bypass Worker CPU.
  if(['/privacy-policy','/privacy-policy.html'].includes(url.pathname)&&/^en(?:-[a-z0-9]+)*(?:[,;].*)?$/i.test(request.headers.get('accept-language')||'')){
   return protect(new Response(null,{status:302,headers:{Location:'/privacy-policy/en',Vary:'Accept-Language','Cache-Control':'private, no-store'}}));
  }
  const routes={'/privacy-policy':'/privacy-policy.html','/privacy-policy/en':'/privacy-policy-en.html','/privacy-policy/ko':'/privacy-policy.html','/terms-of-service':'/terms-of-service.html','/admin':'/admin.html'};
  if(routes[url.pathname])url.pathname=routes[url.pathname];
  return protect(await env.ASSETS.fetch(new Request(url,request)));
 }
};
