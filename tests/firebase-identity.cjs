const assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm'),fs=require('node:fs');
process.env.KAKAO_CLIENT_SECRET='test-only-secret';process.env.SITE_ORIGIN='https://test.example';
const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
process.env.FIREBASE_SERVICE_ACCOUNT_JSON=JSON.stringify({project_id:'pickatime-meet',client_email:'test@pickatime-meet.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})});
const handler=require('../api/firebase-token');
function cookie(id='kakao_123',exp=Date.now()+60000){const body=Buffer.from(JSON.stringify({id,exp})).toString('base64url');return 'wmd_session='+body+'.'+crypto.createHmac('sha256',process.env.KAKAO_CLIENT_SECRET).update('pickatime:session:v1:'+body).digest('base64url');}
async function call(headers={},method='POST'){
 const req={method,headers:{origin:'https://test.example',cookie:cookie(),...headers},body:{uid:'kakao_999'}};
 const res={headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.code=s;return this},json(b){this.body=b;return this},end(){return this}};
 await handler(req,res);return res;
}
(async()=>{
 let r=await call();assert.equal(r.code,200);assert.match(r.headers['Cache-Control'],/no-store/);
 const [h,p,sig]=r.body.token.split('.');assert(crypto.verify('RSA-SHA256',Buffer.from(h+'.'+p),publicKey,Buffer.from(sig,'base64url')));
 const payload=JSON.parse(Buffer.from(p,'base64url'));assert.equal(payload.uid,'kakao_123');assert(payload.exp-payload.iat<=60);assert.equal(r.body.uid,'kakao_123');
 assert.equal((await call({origin:'https://attacker.example'})).code,403);
 assert.equal((await call({origin:''})).code,403);assert.equal((await call({cookie:''})).code,401);
 assert.equal((await call({cookie:cookie()+'bad'})).code,401);assert.equal((await call({cookie:cookie('kakao_123',Date.now()-1)})).code,401);
 assert.equal((await call({},'GET')).code,405);delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;assert.equal((await call()).code,503);
 const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/firebase-identity.js'),'utf8');
 let fetches=0,persistence=[],signs=0,auth={currentUser:null,async setPersistence(v){persistence.push(v)},async signInWithCustomToken(t){signs++;this.currentUser={uid:t==='good'?'kakao_123':'kakao_999'}},async signOut(){this.currentUser=null}};
 const firebase={auth:Object.assign(()=>auth,{Auth:{Persistence:{NONE:'NONE'}}})};
 const ctx={window:{firebase,APP_CONFIG:{authServer:'https://test.example'}},firebase,URL,AbortSignal,Error,fetch:async()=>{fetches++;return {ok:true,json:async()=>({uid:'kakao_123',token:'good'})}}};
 vm.runInNewContext(source,ctx);
 await Promise.all([ctx.window.FirebaseIdentity.ensure('kakao_123'),ctx.window.FirebaseIdentity.ensure('kakao_123')]);assert.equal(fetches,1);assert.equal(signs,1);assert(persistence.every(x=>x==='NONE'));
 await ctx.window.FirebaseIdentity.ensure('kakao_123');assert.equal(fetches,1);
 await ctx.window.FirebaseIdentity.clear();assert.equal(auth.currentUser,null);
 ctx.fetch=async()=>({ok:true,json:async()=>({uid:'kakao_999',token:'evil'})});await assert.rejects(ctx.window.FirebaseIdentity.ensure('kakao_123'),/계정/);assert.equal(auth.currentUser,null);
 ctx.fetch=async()=>({ok:false,json:async()=>({error:'configured later'})});await assert.rejects(ctx.window.FirebaseIdentity.ensure('kakao_123'),/configured later/);
 ctx.fetch=async()=>({ok:true,json:async()=>({uid:'kakao_123',token:'good'})});await ctx.window.FirebaseIdentity.ensure('kakao_123');assert.equal(auth.currentUser.uid,'kakao_123');
 const rules=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../database.secure.rules.json'))).rules.sessions.$sid;
 for(const group of ['votes','members']){
  const expression=rules[group].$mid['.write'];const evaluate=(uid,mid,exists)=>new Function('auth','$mid','$sid','root','return '+expression)(uid?{uid}:null,mid,'test-session',{child(){return this},exists:()=>exists});
  assert.equal(evaluate(null,'kakao_123',true),false);assert.equal(evaluate('kakao_999','kakao_123',true),false);assert.equal(evaluate('kakao_123','kakao_123',false),false);assert.equal(evaluate('kakao_123','kakao_123',true),true);
 }
 assert(!rules['.write']);assert(!rules.votes['.write']);
 console.log('PASS: signed-session identity only, RSA signature and expiry, origin/method/forgery/config rejection, memory-only Firebase login, concurrent deduplication, mismatch/failure retry, own-member and own-vote rule expressions. Rules evaluated locally; Firebase emulator/live tests pending.');
})().catch(e=>{console.error(e);process.exitCode=1});
