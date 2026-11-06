// Server-owned metadata and reservations. Raw sticker choices are never overwritten.
const crypto=require('node:crypto');
const {db,patch}=require('./firebase-admin-rest');
const {privateKey,validId}=require('./admin-index');
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
const ownerId=(uid,title)=>'m_'+crypto.createHash('sha256').update(JSON.stringify([uid,title.trim().normalize('NFC')])).digest('hex');
const profilePath=uid=>'profiles/'+privateKey('pickatime:profile:v1:'+uid.slice(6));
const today=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
function bounds(meta){
 const parse=value=>{
  if(typeof value!=='string'||!/^\d{4}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.test(value))return null;
  const full=value.length===7?value+'-01':value,date=new Date(full+'T00:00:00Z');
  return Number.isFinite(+date)&&date.toISOString().slice(0,10)===full?date:null;
 };
 const a=parse(meta?.start),b=parse(meta?.end);
 if(!a||!b||meta.start.length!==meta.end.length)return null;
 const end=meta.end.length===7?new Date(Date.UTC(b.getUTCFullYear(),b.getUTCMonth()+1,0)).toISOString().slice(0,10):meta.end;
 return {start:meta.start.length===7?meta.start+'-01':meta.start,end};
}
function validPeriod(meta){
 const b=bounds(meta);if(!b)return false;
 const first=b.start<today()?today():b.start;
 const months=(+meta.end.slice(0,4)-+meta.start.slice(0,4))*12+(+meta.end.slice(5,7)-+meta.start.slice(5,7))+1;
 return months>=1&&months<=6&&Date.parse(b.end)-Date.parse(first)>=86400000;
}
const inRange=(date,meta)=>{const b=bounds(meta);return !!b&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=b.start&&date<=b.end&&bounds({start:date,end:date})!==null};
function assertOwner(sid,meta,user){if(!meta||ownerId(user.id,meta.originalTitle||meta.title)!==sid)fail(403,'모임을 만든 사람만 수정할 수 있어요.');}
// A short, server-only lease serializes metadata and reservation batches. It prevents a concurrent confirm/cancel/delete from leaving stale X marks.
async function locked(sid,fn){
 const path='workflowLocks/changes',accessToken=await require('./firebase-admin-rest').token();
 const url='https://pickatime-meet-default-rtdb.asia-southeast1.firebasedatabase.app/'+path+'.json';
 const headers={Authorization:'Bearer '+accessToken};
 const r=await fetch(url,{headers:{...headers,'X-Firebase-ETag':'true'},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('LOCK_READ_FAILED');const old=await r.json();
 if(old?.until>Date.now())throw Object.assign(Error('다른 수정 작업을 저장 중이에요. 잠시 후 다시 시도해 주세요.'),{status:409,retryable:true});
 const lease={id:crypto.randomUUID(),until:Date.now()+180000};
 const acquired=await fetch(url,{method:'PUT',headers:{...headers,'Content-Type':'application/json','if-match':r.headers.get('etag')},body:JSON.stringify(lease),signal:AbortSignal.timeout(15000)});
 if(!acquired.ok)throw Object.assign(Error('동시에 변경된 내용이 있어요. 다시 시도해 주세요.'),{status:409,retryable:acquired.status===412});
 await acquired.arrayBuffer();
 try{return await fn()}finally{
  // Conditional release cannot remove a lease subsequently acquired by another request.
  const current=await fetch(url,{headers:{...headers,'X-Firebase-ETag':'true'},signal:AbortSignal.timeout(15000)}).catch(()=>null);
  if(current?.ok){const value=await current.json();if(value?.id===lease.id)await fetch(url,{method:'PUT',headers:{...headers,'Content-Type':'application/json','if-match':current.headers.get('etag')},body:'null',signal:AbortSignal.timeout(15000)}).then(r=>r.arrayBuffer()).catch(()=>{});}
 }
}
async function conflictPatch(sid,session,next){
 const changes={},old=session.meta.confirmed,previous=await db('workflowJobs/'+sid);
 const users=new Set([...Object.keys(old?.attendees||{}),...Object.keys(next?.attendees||{}),...Object.keys(previous?.users||{}),...(previous?.cursor?[previous.cursor.uid]:[])]);
 const validUsers=[...users].filter(uid=>/^kakao_[0-9]+$/.test(uid));
 for(const uid of validUsers)changes[`reservations/${uid}/${sid}`]=next?.attendees?.[uid]?{date:next.date,slot:next.slot}:null;
 if(validUsers.length||Object.keys(previous?.syncUsers||{}).length){
  changes['workflowJobs/'+sid]={users:Object.fromEntries(validUsers.map(uid=>[uid,true])),syncUsers:previous?.syncUsers||{},by:session.meta.confirmed?.by||next?.by||previous?.by,at:Date.now()};
 }else changes['workflowJobs/'+sid]=null;
 return changes;
}
// Durable outbox: each request stays below the Workers Free external request limit.
// The browser drains it immediately; a cron resumes if the browser closes.
async function advance(sid){
 return locked(sid,async()=>{
  const job=await db('workflowJobs/'+sid);if(!job)return {pending:false};
  const sourceMeta=await db('sessions/'+sid+'/meta'),confirmed=sourceMeta?.confirmed;
  const users={...job.users},syncUsers={...job.syncUsers},changes={};let cursor=job.cursor||null,budget=22;
  while(budget>=3){
   if(!cursor){
    const uid=Object.keys(users)[0];if(!uid)break;
    const ids=Object.keys(await db(profilePath(uid)+'/meetings')||{}).filter(id=>validId(id)&&id!==sid);budget--;
    cursor={uid,targets:ids};
   }
   const uid=cursor.uid,booking=confirmed?.attendees?.[uid]?{date:confirmed.date,slot:confirmed.slot}:null;
   while(cursor.targets.length&&budget>=2){
    const target=cursor.targets[0];
    const [meta,member]=await Promise.all([db(`sessions/${target}/meta`),db(`sessions/${target}/members/${uid}`)]);budget-=2;
    if(meta&&member)changes[`sessions/${target}/blocked/${uid}/${sid}`]=booking&&inRange(booking.date,meta)?booking:null;
    cursor.targets.shift();
   }
   if(cursor.targets.length)break;
   delete users[uid];cursor=null;
  }
  while(budget>=4&&Object.keys(syncUsers).length){
   const uid=Object.keys(syncUsers)[0];
   const [bookings,blocked,member,meta]=await Promise.all([db('reservations/'+uid),db(`sessions/${sid}/blocked/${uid}`),db(`sessions/${sid}/members/${uid}`),db(`sessions/${sid}/meta`)]);budget-=4;
   if(member&&meta)for(const source of new Set([...Object.keys(bookings||{}),...Object.keys(blocked||{})])){
    if(!validId(source)||source===sid)continue;const booking=bookings?.[source];
    changes[`sessions/${sid}/blocked/${uid}/${source}`]=booking&&inRange(booking.date,meta)?booking:null;
   }
   delete syncUsers[uid];
  }
  const pending=Object.keys(users).length+Object.keys(syncUsers).length>0;
  changes['workflowJobs/'+sid]=pending?{...job,users,syncUsers,cursor:cursor||null}:null;
  if(!pending&&sourceMeta)changes[`sessions/${sid}/meta/syncPending`]=null;
  await patch(changes);return {pending,remaining:Object.keys(users).length+Object.keys(syncUsers).length};
 });
}
async function drainOne(){
 const jobs=await db('workflowJobs');const sid=Object.keys(jobs||{}).find(validId);if(sid)await advance(sid);
}
async function syncUser(uid,sid){
 // Reconcile by source, including removed bookings, when joining a poll created later.
 const [bookings,blocked,member,meta]=await Promise.all([db('reservations/'+uid),db(`sessions/${sid}/blocked/${uid}`),db(`sessions/${sid}/members/${uid}`),db(`sessions/${sid}/meta`)]);
 if(!member||!meta)return;
 const changes={};
 for(const source of new Set([...Object.keys(bookings||{}),...Object.keys(blocked||{})])){
  if(!validId(source)||source===sid)continue;
  const booking=bookings?.[source];
  changes[`sessions/${sid}/blocked/${uid}/${source}`]=booking&&inRange(booking.date,meta)?booking:null;
 }
 if(Object.keys(changes).length)await patch(changes);
}
async function run(body,user){
 const sid=body.sid;
 if(!validId(sid))fail(400,'잘못된 투표 주소입니다.');
 if(body.action==='advance'){const job=await db('workflowJobs/'+sid);if(job&&job.by!==user.id)fail(403,'모임장만 반영 작업을 진행할 수 있어요.');return advance(sid);}
 if(body.action==='sync')return locked(sid,async()=>{await syncUser(user.id,sid);return {synced:true};});
 return locked(sid,async()=>{
  const session=await db('sessions/'+sid),meta=session?.meta;
  if(body.action==='create'){
   const input=body.meta||{},title=typeof input.title==='string'?input.title.trim().normalize('NFC'):'';
   if(!title||title.length>30||sid!==ownerId(user.id,title))fail(400,'모임 이름을 확인해 주세요.');
   if(meta)fail(409,'이미 만든 모임이에요.');
   if(await require('./admin-index').deleted(sid))fail(409,'삭제한 투표와 같은 이름이에요. 다른 이름을 입력해 주세요.');
   if(!validPeriod(input)||(input.start.length===10&&input.start<today()))fail(400,'오늘 이후 후보 날짜를 최소 2일, 최대 6개월까지 선택해 주세요.');
   if(!Number.isSafeInteger(input.expectedCount)||input.expectedCount<2||input.expectedCount>100)fail(400,'참여 인원은 2~100명으로 입력해 주세요.');
   const value={title,originalTitle:title,start:input.start,end:input.end,expectedCount:input.expectedCount,createdAt:Date.now()};
   await patch({[`sessions/${sid}/meta`]:value,[profilePath(user.id)+'/meetings/'+sid]:true,[`profiles/${privateKey('pickatime:admin-meeting-index:v1')}/meetings/${sid}`]:true});
   return {meta:value};
  }
  if(!meta)fail(404,'투표를 찾을 수 없어요.');
  if(body.action==='join'){
   const name=typeof body.name==='string'?body.name.trim():'';
   if(!name||name.length>10)fail(400,'닉네임은 1~10자로 입력해 주세요.');
   const old=session.members?.[user.id];
   if(meta.confirmed&&!old)fail(409,'이미 날짜가 확정된 모임이에요.');
   if(!old&&Object.keys(session.members||{}).length>=100)fail(409,'참여 인원은 최대 100명이에요.');
   const member={name,joinedAt:old?.joinedAt||Date.now()};
   await patch({[`sessions/${sid}/members/${user.id}`]:member,[profilePath(user.id)+'/meetings/'+sid]:true,[profilePath(user.id)+'/nickname']:name});
   await syncUser(user.id,sid);return {member};
  }
  assertOwner(sid,meta,user);
  if(body.action==='update'){
   const input=body.changes||{},keys=Object.keys(input);
   if(!keys.length||keys.some(k=>!['title','start','end','expectedCount'].includes(k)))fail(400,'수정할 내용을 확인해 주세요.');
   if(('start'in input)!==('end'in input))fail(400,'시작과 종료 날짜를 함께 선택해 주세요.');
   if('title'in input&&(typeof input.title!=='string'||!input.title.trim()||input.title.trim().length>30))fail(400,'모임 이름은 1~30자로 입력해 주세요.');
   if('expectedCount'in input&&(!Number.isSafeInteger(input.expectedCount)||input.expectedCount<Math.max(2,Object.keys(session.members||{}).length)||input.expectedCount>100))fail(400,'예정 인원은 현재 참여 인원 이상, 2~100명으로 입력해 주세요.');
   if('start'in input&&(meta.confirmed||!validPeriod(input)))fail(400,meta.confirmed?'날짜 확정을 취소한 뒤 후보 날짜를 바꿔 주세요.':'후보 날짜를 최소 2일, 최대 6개월까지 선택해 주세요.');
   const next={...meta,...input,originalTitle:meta.originalTitle||meta.title};if(input.title)next.title=input.title.trim().normalize('NFC');
   // Patch only metadata, so concurrent sticker saves cannot be overwritten.
   const changes={[`sessions/${sid}/meta`]:next};
   if('start'in input){const job=await db('workflowJobs/'+sid)||{};changes['workflowJobs/'+sid]={...job,users:job.users||{},syncUsers:Object.fromEntries(Object.keys(session.members||{}).map(uid=>[uid,true])),by:user.id,at:Date.now()};}
   if('start'in input)changes[`sessions/${sid}/meta`].syncPending=true;
   await patch(changes);return {meta:next,pending:'start'in input};
  }
  if(!['confirm','cancel'].includes(body.action))fail(400,'잘못된 요청입니다.');
  let confirmed=null;
  if(body.action==='confirm'){
   if(!inRange(body.date,meta)||body.date<today()||!['L','D'].includes(body.slot))fail(400,'후보 기간 안에서 오늘 이후의 점심·저녁을 선택해 주세요.');
   const attendees={[user.id]:true};
   for(const uid of Object.keys(session.members||{}))attendees[uid]=true;
   const bookings=await db('reservations/'+user.id)||{};
   if(Object.entries(bookings).some(([source,b])=>source!==sid&&b.date===body.date&&b.slot===body.slot))fail(409,'이 시간에 이미 확정된 다른 모임이 있어요. 먼저 기존 확정을 취소해 주세요.');
   confirmed={date:body.date,slot:body.slot,at:Date.now(),by:user.id,attendees};
  }
  const changes=await conflictPatch(sid,session,confirmed);changes[`sessions/${sid}/meta/confirmed`]=confirmed;changes[`sessions/${sid}/meta/syncPending`]=!!changes['workflowJobs/'+sid];
  await patch(changes);return {confirmed,pending:!!changes['workflowJobs/'+sid]};
 });
}
module.exports={run,locked,conflictPatch,syncUser,assertOwner,bounds,inRange,validPeriod,ownerId,advance,drainOne};
