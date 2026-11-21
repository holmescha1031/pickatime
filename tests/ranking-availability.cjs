const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const Trip=require('../assets/trip-votes'),State=require('../assets/meeting-state');
const data={meta:{title:'순위 예시',start:'2026-11-23',end:'2026-11-30',expectedCount:7,createdAt:Date.parse('2026-11-21')},members:{},votes:{}};
for(let i=1;i<=7;i++){
 const id='kakao_'+i;data.members[id]={name:'예시'+i};data.votes[id]={};
 if(i<=6)data.votes[id]['2026-11-24']={D:2};
 if(i<=5)data.votes[id]['2026-11-23']={D:3};
 if(i===6)data.votes[id]['2026-11-23']={L:3,D:4};
}
const c={URL,S:data,window:{TripVotes:Trip,MeetingState:State,VoteTransfer:{bounds:()=>({start:data.meta.start,end:data.meta.end})}},todayStr:()=> '2026-11-21',inMeetingRange:d=>d>=data.meta.start&&d<=data.meta.end,parseYmd:d=>new Date(d+'T12:00:00Z'),pad:n=>String(n).padStart(2,'0'),WD:['일','월','화','수','목','금','토'],PUBLIC_SITE_URL:'https://pickatime.xyz/'};
vm.createContext(c);
vm.runInContext(html.slice(html.indexOf('const LEVEL_TEXT='),html.indexOf('function renderCalendar('))+html.slice(html.indexOf('function computeRank('),html.indexOf('function renderRank('))+html.slice(html.indexOf('function rankShareState('),html.indexOf('function shareRankStatus('))+html.slice(html.indexOf('function meetingPreview('),html.indexOf('function navigateToMeeting(')),c);
let ranked=c.computeRank().list;
assert.deepEqual(Array.from(ranked,r=>[r.d,r.sl,r.count,r.unavailable]),[['2026-11-24','D',6,0],['2026-11-23','D',5,1],['2026-11-23','L',1,0]]);
assert.equal(ranked[1].lv.kakao_7,undefined,'Missing responses must stay unanswered');
assert.match(c.meetingPreview('example',data,'kakao_1').top,/11\.24.*저녁/);
const shared=c.rankShareState();assert.equal(shared.dates[1].sl,'D');
const args=c.rankKakaoTemplateArgs('example',data.meta.title,shared);assert.equal(args.desc1,'6/7명 가능');assert.match(args.title2,/11월 23일.*저녁/);assert.equal(args.desc2,'5/7명 가능');
const stats=require('../lib/admin-stats').summarize([{data}],{now:Date.parse('2026-11-21')});assert.equal(stats.rooms[0].best.date,ranked[0].d);
// With equal positive counts, fewer explicit X responses win; then stronger positive responses win.
const tie={...data,votes:{kakao_1:{'2026-11-23':{L:3,D:1},'2026-11-24':{L:2,D:2}},kakao_2:{'2026-11-24':{D:4}}}};
assert.deepEqual(Array.from(c.computeRank(tie).list,r=>r.d+r.sl),['2026-11-23D','2026-11-24L','2026-11-23L','2026-11-24D']);
// A reservation overlay counts as X but does not erase the other members' positive responses.
const blocked={...data,blocked:{kakao_5:{other:{date:'2026-11-23',slot:'D'}}}};
assert.equal(c.computeRank(blocked).list[1].count,4);assert.equal(data.votes.kakao_5['2026-11-23'].D,3);
// Consecutive trip candidates follow the same priority, keeping incomplete days unanswered.
const travel={...data,meta:{...data.meta,meetingType:'trip',tripDays:2},votes:{}};
for(let i=1;i<=7;i++){
 const id='kakao_'+i;travel.votes[id]={};
 for(const d of ['2026-11-23','2026-11-24'])if(i<=5||i===6)travel.votes[id][d]={L:i===6?4:3,D:i===6?4:3};
 if(i===6)for(const d of ['2026-11-26','2026-11-27'])travel.votes[id][d]={L:3,D:3};
}
ranked=c.computeRank(travel).list;assert.equal(ranked[0].count,5);assert.equal(ranked[0].unavailable,1);assert.equal(ranked[0].d,'2026-11-23');assert.equal(ranked[0].endDate,'2026-11-24');assert.equal(ranked[1].count,1);
console.log('PASS: screenshot regression (6 > 5 with X > 1), unchanged missing/manual responses, tie-breaks, legacy levels, reservation overlays, list/share/admin parity, consecutive trip ranking.');
