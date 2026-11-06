const assert=require('node:assert/strict'),crypto=require('node:crypto');
process.env.KAKAO_CLIENT_SECRET='workflow-test-secret';
const keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
process.env.FIREBASE_SERVICE_ACCOUNT_JSON=JSON.stringify({project_id:'pickatime-meet',client_email:'workflow@test',private_key:keys.privateKey.export({type:'pkcs8',format:'pem'})});
let root={},calls=0,etag=0,failPatch=false;
const copy=x=>x==null?null:JSON.parse(JSON.stringify(x));
function get(path){return path.split('/').filter(Boolean).reduce((o,k)=>o?.[k],root)??null}
function put(path,v){const parts=path.split('/').filter(Boolean);let o=root;for(const p of parts.slice(0,-1))o=o[p]??={};if(v==null)delete o[parts.at(-1)];else o[parts.at(-1)]=copy(v);etag++;}
global.fetch=async(url,opt={})=>{
 calls++;if(url==='https://oauth2.googleapis.com/token')return new Response(JSON.stringify({access_token:'server-token',expires_in:3600}));
 assert.equal(opt.headers?.Authorization,'Bearer server-token');
 const path=new URL(url).pathname.slice(1,-5),method=opt.method||'GET';
 if(method==='GET')return new Response(JSON.stringify(copy(get(path))),{headers:{etag:'"'+etag+'"'}});
 if(opt.headers['if-match']&&opt.headers['if-match']!=='"'+etag+'"')return new Response('{}',{status:412});
 if(method==='PATCH'){
  if(failPatch){failPatch=false;return new Response('{}',{status:503});}
  const changes=JSON.parse(opt.body);assert.equal(path,'');for(const [p,v]of Object.entries(changes))put(p,v);
 }else if(method==='PUT')put(path,JSON.parse(opt.body));else assert.fail(method);
 return new Response('null');
};
const workflow=require('../lib/meeting-workflow'),index=require('../lib/admin-index'),{effectiveVotes,cleanDraft}=require('../assets/meeting-state');
const uid='kakao_11',peer='kakao_22',outsider='kakao_33',user={id:uid},id=workflow.ownerId(uid,'Source'),target=workflow.ownerId(peer,'Target');
const key=u=>'profiles/'+index.privateKey('pickatime:profile:v1:'+u.slice(6));
const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10),tomorrow=new Date(Date.parse(today)+86400000).toISOString().slice(0,10);
const later=new Date(Date.parse(today)+2*86400000).toISOString().slice(0,10);
async function act(action,values={},who=user){calls=0;const result=await workflow.run({action,sid:id,...values},who);assert(calls<50,'must fit Workers Free external requests, got '+calls);return result;}
async function drain(){for(let i=0;i<200;i++){const r=await act('advance');if(!r.pending)return;}assert.fail('outbox did not drain')}
function fixture(){root={};put(`sessions/${target}`,{meta:{title:'Target',start:today,end:later},members:{[uid]:{name:'A',joinedAt:1},[peer]:{name:'B',joinedAt:1}},votes:{[uid]:{[tomorrow]:{L:2,D:3}},[peer]:{[tomorrow]:{L:4}}}});for(const u of [uid,peer])put(key(u)+'/meetings/'+target,true);}
(async()=>{
 fixture();assert(!workflow.validPeriod({start:today,end:today}));assert(!workflow.bounds({start:'2027-02-29',end:'2027-03-01'}));assert(workflow.bounds({start:'2028-02-29',end:'2028-03-01'}));
 await act('create',{meta:{title:'Source',start:today,end:later,expectedCount:2}});
 await act('join',{name:'A'});await act('join',{name:'B'},{id:peer});
 await assert.rejects(act('update',{changes:{title:'Stolen'}},{id:outsider}),e=>e.status===403);
 await assert.rejects(act('confirm',{date:tomorrow,slot:'L'},{id:outsider}),e=>e.status===403);
 await assert.rejects(act('update',{changes:{expectedCount:1}}),e=>e.status===400);
 await act('update',{changes:{title:'Renamed',expectedCount:6}});assert.equal(get(`sessions/${id}/meta/originalTitle`),'Source');assert.equal(get(`sessions/${id}/meta/expectedCount`),6);
 const original=copy(get(`sessions/${target}/votes`));
 // Every member is included, even one whose original vote was impossible.
 let result=await act('confirm',{date:tomorrow,slot:'L'});assert(result.pending);assert.deepEqual(Object.keys(result.confirmed.attendees).sort(),[uid,peer].sort());
 await drain();let targetData=get(`sessions/${target}`);assert.equal(effectiveVotes(targetData.votes,targetData.blocked)[uid][tomorrow].L,4);assert.equal(effectiveVotes(targetData.votes,targetData.blocked)[peer][tomorrow].L,4);assert.deepEqual(targetData.votes,original);
 await assert.rejects(act('update',{changes:{start:today,end:later}}),/확정을 취소/);
 await act('confirm',{date:tomorrow,slot:'D'});await drain();targetData=get(`sessions/${target}`);assert.equal(effectiveVotes(targetData.votes,targetData.blocked)[uid][tomorrow].L,2);assert.equal(effectiveVotes(targetData.votes,targetData.blocked)[uid][tomorrow].D,4);
 await act('cancel');await drain();targetData=get(`sessions/${target}`);assert.deepEqual(targetData.votes,original);assert.equal(effectiveVotes(targetData.votes,targetData.blocked)[uid][tomorrow].D,3);assert.equal(effectiveVotes(targetData.votes,targetData.blocked)[peer][tomorrow].L,4);
 // Two sources at the same time retain X until both sources have been cancelled.
 put(`sessions/${target}/blocked/${uid}/m_${'f'.repeat(64)}`,{date:tomorrow,slot:'L'});
 await act('confirm',{date:tomorrow,slot:'D'});await drain();await act('cancel');await drain();assert.equal(effectiveVotes(get(`sessions/${target}/votes`),get(`sessions/${target}/blocked`))[uid][tomorrow].L,4);
 // A poll joined later inherits existing confirmed reservations.
 await act('confirm',{date:tomorrow,slot:'D'});await drain();const fresh=workflow.ownerId(uid,'Future');await act('create',{sid:fresh,meta:{title:'Future',start:today,end:later,expectedCount:2}});await act('join',{sid:fresh,name:'A'});assert.equal(effectiveVotes({},get(`sessions/${fresh}/blocked`))[uid][tomorrow].D,4);
 await assert.rejects(act('confirm',{sid:fresh,date:tomorrow,slot:'D'}),e=>e.status===409);
 // Durable retries: a failing atomic patch never claims job progress.
 failPatch=true;await assert.rejects(act('cancel'));assert(get(`sessions/${id}/meta/confirmed`));await act('cancel');await drain();
 // A large fan-out is resumed across invocations and never exceeds 50 fetches.
 for(let n=0;n<70;n++){const x=workflow.ownerId(peer,'Many'+n);put(`sessions/${x}`,{meta:{title:'Many',start:today,end:later},members:{[peer]:{name:'B',joinedAt:1}}});put(key(peer)+'/meetings/'+x,true);}
 await act('confirm',{date:tomorrow,slot:'D'});await drain();assert.equal(get(`sessions/${workflow.ownerId(peer,'Many69')}/blocked/${peer}/${id}/slot`),'D');
 // Pending confirmation immediately changed/cancelled must not resurrect stale blocks.
 await act('confirm',{date:tomorrow,slot:'L'});await act('cancel');await drain();assert.equal(get(`reservations/${peer}/${id}`),null);assert.equal(get(`sessions/${target}/blocked/${peer}/${id}`),null);
 const draft={at:Date.now(),votes:{[today]:{L:2,D:4},[later]:{L:9},'bad':{D:2}}};assert.deepEqual(cleanDraft(draft,today,later),{[today]:{L:2,D:4}});assert.deepEqual(cleanDraft({...draft,at:Date.now()-86400001},today,later),{});
 const before=copy(get(`sessions/${target}/votes`));effectiveVotes(before,get(`sessions/${target}/blocked`));assert.deepEqual(before,get(`sessions/${target}/votes`));
 const tripId=workflow.ownerId(uid,'Travel'),tripEnd=new Date(Date.parse(today)+14*86400000).toISOString().slice(0,10);
 await act('create',{sid:tripId,meta:{title:'Travel',start:today,end:tripEnd,expectedCount:2,meetingType:'trip',tripDays:5}});
 await act('join',{sid:tripId,name:'A'});await act('join',{sid:tripId,name:'B'},{id:peer});
 await assert.rejects(act('confirm',{sid:tripId,date:tripEnd,slot:'L'}),e=>e.status===400);
 await act('confirm',{date:later,slot:'D'});await assert.rejects(act('confirm',{sid:tripId,date:tomorrow,slot:'L'}),e=>e.status===409);await act('cancel');await drain();
 const tripResult=await act('confirm',{sid:tripId,date:tomorrow,slot:'L'});assert.equal(tripResult.confirmed.endDate,new Date(Date.parse(tomorrow)+4*86400000).toISOString().slice(0,10));
 for(let step=0;step<200;step++){if(!(await act('advance',{sid:tripId})).pending)break;}
 let targetState=get(`sessions/${target}`),tripVotes=effectiveVotes(targetState.votes,targetState.blocked);assert.equal(tripVotes[uid][tomorrow].L,4);assert.equal(tripVotes[uid][tomorrow].D,4);assert.equal(tripVotes[uid][later].D,4);
 await act('cancel',{sid:tripId});for(let step=0;step<200;step++){if(!(await act('advance',{sid:tripId})).pending)break;}
 assert.equal(effectiveVotes(get(`sessions/${target}/votes`),get(`sessions/${target}/blocked`))[uid][tomorrow].D,3);
 console.log('PASS: server ownership, create/join/count validation, all-member reservations, exact slot X, restore manual choices, overlapping sources, change/cancel, future joins, atomic retry, interrupted fan-out, 70-poll batch limits, guest expiry and non-mutating overlays.');
})().catch(e=>{console.error(e);process.exitCode=1});
