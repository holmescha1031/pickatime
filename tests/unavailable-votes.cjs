const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const dir=require('path').join(__dirname,'..')+'/',html=fs.readFileSync(dir+'index.html','utf8');
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/\bsrc=|type=["']module/.test(m[1]))new vm.Script(m[2]);
for(const p of ['assets/vote-drag-v3.js','assets/vote-import-v3.js','assets/admin.js','assets/analytics.js','lib/admin-stats.js'])new vm.Script(fs.readFileSync(dir+p,'utf8'));
const data={meta:{start:'2027-01',end:'2027-01',expectedCount:4,createdAt:Date.parse('2026-10-29')},members:{kakao_1:{name:'A'},kakao_2:{name:'B'},kakao_3:{name:'C'},kakao_4:{name:'D'}},votes:{kakao_1:{'2027-01-01':{L:2},'2027-01-02':{L:2},'2027-01-03':{L:4},'2027-01-04':{L:3}},kakao_2:{'2027-01-01':{L:2},'2027-01-02':{L:4}},kakao_3:{'2027-01-01':{L:4}},kakao_4:{'2027-01-01':{L:4}}}};
const ctx={S:data,window:{},todayStr:()=> '2026-10-29',inMeetingRange:d=>d>='2027-01-01'&&d<='2027-01-31',parseYmd:d=>new Date(d+'T12:00:00'),pad:n=>String(n).padStart(2,'0'),WD:['일','월','화','수','목','금','토']};vm.createContext(ctx);
vm.runInContext(html.slice(html.indexOf('const LEVEL_TEXT='),html.indexOf('function renderCalendar('))+html.slice(html.indexOf('function computeRank('),html.indexOf('function renderRank('))+html.slice(html.indexOf('function rankShareState('),html.indexOf('function attendanceInfo(')),ctx);
const list=ctx.computeRank(data).list;assert.deepEqual(Array.from(list,r=>r.d),['2027-01-04','2027-01-02','2027-01-01']);assert.equal(list.at(-1).count,2);assert.equal(list.at(-1).unavailable,2);assert.equal(list.at(-1).score,0);assert(!list.some(r=>r.d==='2027-01-03'));
const share=ctx.rankShareState(data);assert.equal(share.voted,4);assert.equal(share.complete,true);assert.equal(share.dates[0].d,'2027-01-04');
const no={...data,votes:{kakao_1:{'2027-01-03':{L:4}}}};assert.equal(ctx.computeRank(no).list.length,0);assert.equal(ctx.rankShareState(no).voted,1);
vm.runInContext('globalThis.norm=normalizeVoteLevel;globalThis.next=nextVoteLevel;',ctx);assert.equal(ctx.norm(1),2);assert.equal(ctx.norm(4),4);assert.equal(ctx.next(4),0);assert.equal(ctx.next(3),0);
const heat=ctx.calendarVoteHeat(data);assert.equal(heat.counts['2027-01-01|L'],2);
vm.runInContext(fs.readFileSync(dir+'assets/vote-import-v3.js','utf8'),ctx);const plan=ctx.window.VoteTransfer.plan(data.meta,data.meta,{'2027-01-02':{L:4,D:1}},{'2027-01-02':{L:2}},'2026-10-29');assert.equal(plan.cells.length,1);assert.equal(plan.cells[0].level,2);const copied=ctx.window.VoteTransfer.plan(data.meta,data.meta,{'2027-01-02':{L:4}},{},'2026-10-29');assert.equal(copied.cells[0].level,4);
const stats=require('../lib/admin-stats').summarize([{data}],{now:Date.parse('2026-10-29')});assert.equal(stats.totals.voters,4);assert.equal(stats.totals.unavailable,4);assert.equal(stats.totals.stickers,8);assert.equal(stats.rooms[0].best.date,list[0].d);assert.equal(stats.rooms[0].best.count,list[0].count);
const rule=JSON.parse(fs.readFileSync(dir+'database.rules.json','utf8')).rules.sessions.$sid.votes.$mid.$date.$slot['.validate'];for(const value of [1,2,3,4])assert(new Function('newData','$slot','return '+rule)({isNumber:()=>true,val:()=>value},'L'));assert(!new Function('newData','$slot','return '+rule)({isNumber:()=>true,val:()=>5},'L'));
console.log('PASS ranking: unavailable precedence, score, positive candidates, explicit-only participation, legacy levels, heat, imports, admin parity, rule values, syntax');

// Exercise actual gesture handlers with a deterministic clock and native event ordering.
function target(){const handlers={};return {handlers,addEventListener(n,f){(handlers[n]??=[]).push(f)},removeEventListener(n,f){handlers[n]=(handlers[n]||[]).filter(x=>x!==f)},emit(n,e={}){e.preventDefault??=()=>{e.prevented=true};e.stopImmediatePropagation??=()=>{e.stopped=true};for(const f of handlers[n]||[])f(e);return e}}}
const root=target(),doc=target(),win=target(),timers=new Map();let seq=0,hit,clock=1000;root.contains=el=>[a,b,disabled].includes(el);const cell=(l,disabled=false)=>({dataset:{l:String(l)},disabled,closest(){return this}}),a=cell(0),b=cell(0),disabled=cell(0,true);doc.elementFromPoint=()=>hit;
const calls=[],g={window:win,document:doc,Date:{now:()=>clock},setTimeout:f=>{timers.set(++seq,f);return seq},clearTimeout:id=>timers.delete(id)};vm.createContext(g);vm.runInContext(fs.readFileSync(dir+'assets/vote-drag-v3.js','utf8'),g);const detach=win.attachVoteDrag(root,(el,l,method)=>{calls.push([el,l,method]);el.dataset.l=String(l)});const fire=()=>{clock+=600;for(const [id,f]of [...timers]){timers.delete(id);f()}};
const pd=el=>root.emit('pointerdown',{target:el,pointerType:'mouse',button:0,clientX:10,clientY:10});
pd(a);assert.equal(calls.length,0);doc.emit('pointerup');fire();assert.equal(calls.length,0);assert(!root.emit('click',{target:a}).stopped); // normal tap belongs to app click handler
pd(a);fire();assert.equal(calls.at(-1)[1],4);assert.equal(calls.at(-1)[2],'long_press');doc.emit('pointerup');assert(root.emit('click',{target:a}).stopped);
pd(a);fire();assert.equal(calls.at(-1)[1],0);doc.emit('pointerup');
pd(a);hit=b;doc.emit('pointermove',{clientX:30,clientY:10});assert.equal(a.dataset.l,'2');assert.equal(b.dataset.l,'2');assert.equal(timers.size,0);doc.emit('pointerup');
const before=calls.length;root.emit('touchstart',{target:a,touches:[{clientX:10,clientY:10}]});root.emit('touchmove',{touches:[{clientX:11,clientY:30}]});fire();assert.equal(calls.length,before); // scroll must not mark impossible
root.emit('touchstart',{target:b,touches:[{clientX:10,clientY:10}]});fire();assert.equal(b.dataset.l,'4');doc.emit('touchend');assert(root.emit('click',{target:b}).stopped);
root.emit('keydown',{target:b,shiftKey:true,key:'Enter'});assert.equal(b.dataset.l,'0');
pd(disabled);fire();assert.equal(calls.at(-1)[1],0);
pd(a);detach();const after=calls.length;fire();assert.equal(calls.length,after);assert.equal(timers.size,0);
console.log('PASS gestures: quick click, desktop and touch hold, hold removal, drag, scroll cancellation, keyboard, disabled days, cleanup, duplicate click suppression');

(async()=>{
 const core={window:{}};vm.createContext(core);vm.runInContext(fs.readFileSync(dir+'assets/vote-save-state.js','utf8'),core);
 const tracker=core.window.createVoteSaveTracker(),writes=[],counts=[],analytics=[];let denied=true;
 const state={me:'kakao_1',members:{kakao_1:{},kakao_2:{}},votes:{kakao_2:{'2027-01-01':{L:2}}}},cell={dataset:{d:'2027-01-01',s:'L',l:'0'}};
 const w={S:state,sid:'poll',inMeetingRange:()=>true,voteSaves:tracker,voteSaveKey:()=> 'poll:kakao_1',voteFinishBusy:null,myVotes:()=>state.votes.kakao_1||{},normalizeVoteLevel:n=>n,applyCalendarHeat:(b,n)=>counts.push(n),calendarVoteTotal:()=>2,navigator:{vibrate(){}},store:{set:async(p,v)=>{if(denied)throw Error('PERMISSION_DENIED');writes.push([p,v])}},usage:(...args)=>analytics.push(args)};
 vm.createContext(w);vm.runInContext(html.slice(html.indexOf('function setVoteLevel('),html.indexOf('function syncCalendar(')),w);
 w.setVoteLevel(cell,4,'long_press');await tracker.settle('poll:kakao_1');assert.equal(state.votes.kakao_1['2027-01-01'].L,4);assert.equal(counts.at(-1),1);assert.equal(tracker.info('poll:kakao_1').failed,1);assert.equal(analytics.length,0);
 denied=false;await tracker.retry('poll:kakao_1');assert.equal(tracker.info('poll:kakao_1').failed,0);assert.equal(writes.at(-1)[1],4);
 w.setVoteLevel(cell,0);await tracker.settle('poll:kakao_1');assert.equal(writes.at(-1)[1],null);assert(!state.votes.kakao_1['2027-01-01']);
 console.log('PASS acknowledged saves: unavailable persisted, excluded from available count, denied writes remain failed until retry, deletion clears selection');
})().catch(error=>{console.error(error);process.exitCode=1});
