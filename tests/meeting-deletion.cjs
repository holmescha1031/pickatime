const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {readFileSync}=require('node:fs');
const root=require('node:path').join(__dirname,'..');
const secret='test-only-secret';process.env.KAKAO_CLIENT_SECRET=secret;
const owner='kakao_123',other='kakao_456',title='A disposable test';
const id='m_'+crypto.createHash('sha256').update(JSON.stringify([owner,title])).digest('hex');
const key=s=>'u_'+crypto.createHmac('sha256',secret).update(s).digest('hex');
const marker='profiles/'+key('pickatime:deleted-meeting:v1:'+id)+'/meetings/'+id;
let session,deleted,patches,tokenCalls,failPatch,failToken,calls;
const fixture=()=>({meta:{title:'Renamed',originalTitle:title},members:{[owner]:{name:'A'},[other]:{name:'B'}},votes:{[other]:{'2026-12-01':{L:4}}}});
function reset(){session=fixture();deleted=false;patches=[];calls=[];tokenCalls=0;failPatch=false;failToken=false;}
function auth(userId){const payload=Buffer.from(JSON.stringify({id:userId,exp:Date.now()+60000})).toString('base64url');return 'wmd_session='+payload+'.'+crypto.createHmac('sha256',secret).update('pickatime:session:v1:'+payload).digest('base64url');}
global.fetch=async(url,options={})=>{
 calls.push({url,options});
 const response=(ok,body)=>({ok,status:ok?200:403,json:async()=>body});
 if(url==='https://oauth2.googleapis.com/token'){
  tokenCalls++;
  assert.equal(options.method,'POST');
  const assertion=options.body.get('assertion'),parts=assertion.split('.');
  assert(crypto.verify('RSA-SHA256',Buffer.from(parts.slice(0,2).join('.')),publicKey,Buffer.from(parts[2],'base64url')));
  assert.equal(JSON.parse(Buffer.from(parts[1],'base64url')).aud,url);
  return response(!failToken,{access_token:'server-only-token',expires_in:3600});
 }
 const path=new URL(url).pathname;
 if(options.method==='PATCH'){
  assert.equal(path,'/.json');assert.equal(options.headers.Authorization,'Bearer server-only-token');
  assert(!url.includes('server-only-token'));
  const patch=JSON.parse(options.body);patches.push(patch);
  if(failPatch)return response(false,null);
  session=null;deleted=true;return response(true,null);
 }
 if(path===`/sessions/${id}.json`)return response(true,session);
 if(path===`/${marker}.json`)return response(true,deleted);
 throw Error('Unexpected write or read: '+url);
};
const handler=require('../api/meeting');
async function run({cookie=auth(owner),origin='https://pickatime-phi.vercel.app',sid=id,method='POST'}={}){
 const req={method,headers:{cookie,origin},body:{sid,action:'delete'},query:{sid}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.code=s;return this},json(b){this.body=b;return this},end(){return this}};
 await handler(req,res);return res;
}
let publicKey;
(async()=>{
 reset();delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
 assert.equal((await run({cookie:''})).code,401);assert.equal(calls.length,0);
 assert.equal((await run({origin:'https://evil.example'})).code,403);
 assert.equal((await run({sid:'../other'})).code,400);
 assert.equal((await run({cookie:auth(other)})).code,403);assert.equal(patches.length,0);
 const missing=await run();assert.equal(missing.code,503);assert.match(missing.body.error,/아직 삭제되지/);assert.deepEqual(session,fixture());assert.equal(deleted,false);
 const keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048});publicKey=keys.publicKey;
 process.env.FIREBASE_SERVICE_ACCOUNT_JSON=JSON.stringify({project_id:'wrong-project',client_email:'test@test.iam.gserviceaccount.com',private_key:keys.privateKey.export({type:'pkcs8',format:'pem'})});
 assert.equal((await run()).code,503);assert.equal(tokenCalls,0);
 const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);account.project_id='pickatime-meet';process.env.FIREBASE_SERVICE_ACCOUNT_JSON=JSON.stringify(account);
 failToken=true;assert.equal((await run()).code,503);assert.equal(patches.length,0);assert.equal(deleted,false);
 failToken=false;failPatch=true;assert.equal((await run()).code,503);assert.deepEqual(session,fixture());assert.equal(deleted,false);
 failPatch=false;assert.equal((await run()).code,200);assert.equal(session,null);assert.equal(deleted,true);
 const patch=patches.at(-1);assert.equal(Object.keys(patch).length,5);
 assert.equal(patch['sessions/'+id],null);assert.equal(patch[marker],true);
 for(const who of [owner,other])assert.equal(patch['profiles/'+key('pickatime:profile:v1:'+who.slice(6))+'/meetings/'+id],null);
 assert.equal(patch['profiles/'+key('pickatime:admin-meeting-index:v1')+'/meetings/'+id],null);
 const writes=patches.length;assert.equal((await run()).code,200);assert.equal(patches.length,writes);
 assert.equal((await run({method:'GET'})).body.deleted,true);
 const html=readFileSync(root+'/index.html','utf8');assert(html.includes('복구할 수 없어요.'));assert(html.includes('else{sessionLoad++;showDeletedMeeting()}'));
 console.log('Passed: signed owner authorization, rejected origins/IDs/non-owners, missing credentials, JWT signature, token failure retry, atomic deletion failure, session and index erasure, idempotency, old-link status, live-tab handling.');
})().catch(e=>{console.error(e);process.exitCode=1});
