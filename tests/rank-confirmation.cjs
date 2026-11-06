const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('async function confirmRankedDate('),html.indexOf('function renderRank('));
(async()=>{
 const calls=[],messages=[],ctx={S:{isOwner:false,me:'kakao_1',confirmPicking:true,meta:{}},sid:'m_test',sessionLoad:1,renderRank(){},toast:m=>messages.push(m),voteSaves:{settle:async()=>({failed:false})},voteSaveKey:()=>'',meetingAction:async(action,data)=>{calls.push(data);return {confirmed:{date:data.date,slot:data.slot},pending:true}},finishMeetingSync:async()=>{},receiveMeetingMeta:meta=>{ctx.S.meta=meta}};vm.runInNewContext(source,ctx);
 await ctx.confirmRankedDate('2026-12-01','D');assert.equal(calls.length,0);assert.equal(messages.at(-1),'모임 정보는 모임장만 수정할 수 있어요');
 ctx.S.isOwner=true;ctx.voteSaves.settle=async()=>({failed:true});await ctx.confirmRankedDate('2026-12-01','D');assert.equal(calls.length,0);assert.equal(ctx.S.confirmBusy,false);
 ctx.voteSaves.settle=async()=>({failed:false});await ctx.confirmRankedDate('2026-12-01','D');assert.equal(calls[0].slot,'D');assert.equal(ctx.S.meta.confirmed.date,'2026-12-01');assert.equal(ctx.S.confirmPicking,false);assert.equal(ctx.S.meta.syncPending,false);
 ctx.S.confirmPicking=true;ctx.finishMeetingSync=async()=>{throw Error('queued for retry')};await ctx.confirmRankedDate('2026-12-03','L');assert.equal(ctx.S.meta.confirmed.date,'2026-12-03');assert.equal(ctx.S.meta.syncPending,true);assert.equal(ctx.S.confirmPicking,false);
 console.log('PASS: owner-only ranked-date confirmation, unsaved-vote guard, chosen slot/date, direct success, and committed status retained when background propagation needs retry.');
})().catch(e=>{console.error(e);process.exitCode=1});
