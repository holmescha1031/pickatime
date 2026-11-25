const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const S={meta:{},members:{a:{name:'예시가능'},b:{name:'예시불가'},c:{name:'예시미참여'},d:{name:'예시애매'}},votes:{a:{'2026-12-01':{L:2}},b:{'2026-12-02':{D:4}},d:{'2026-12-03':{L:3}}},blocked:{},showAll:false};
const body={innerHTML:''},ids=Object.keys(S.members),c={S,window:{TripVotes:require('../assets/trip-votes'),MeetingState:require('../assets/meeting-state')},todayStr:()=> '2026-11-25',inMeetingRange:d=>d>='2026-12-01'&&d<='2026-12-31',computeRank:()=>({ids,list:[]}),attendanceInfo:()=>({target:4,expected:4,remaining:0}),sortedMemberIds:()=>ids,memberColorMap:()=>Object.fromEntries(ids.map(id=>[id,'#111'])),esc:String,avatar:()=>'',toast(){},$:s=>s==='#body'?body:null};
vm.createContext(c);vm.runInContext(html.slice(html.indexOf('const LEVEL_TEXT='),html.indexOf('function renderCalendar('))+html.slice(html.indexOf('function myCount('),html.indexOf('/* Personal calendar details'))+html.slice(html.indexOf('function renderRank('),html.indexOf('/* ---------- 시작 ---------- */')),c);
c.renderRank();
for(const id of ['a','b','d'])assert(body.innerHTML.includes(S.members[id].name+' <em>참여</em>'));
assert(body.innerHTML.includes('예시미참여 <em>미참여</em>'));assert(!body.innerHTML.includes('1칸'));assert(!body.innerHTML.includes('vote-counts'));
// Realtime changes switch participation labels, including removal, past/out-of-range votes and automatic X.
S.votes={a:{'2026-11-01':{L:2},'2027-01-01':{L:2}}};S.blocked={c:{booking:{date:'2026-12-04',slot:'D'}}};c.renderRank();
assert(body.innerHTML.includes('예시가능 <em>미참여</em>'));assert(body.innerHTML.includes('예시불가 <em>미참여</em>'));assert(body.innerHTML.includes('예시미참여 <em>참여</em>'));
S.blocked={};c.renderRank();assert(body.innerHTML.includes('예시미참여 <em>미참여</em>'));
console.log('PASS: ranking chips show participation only for normal/tentative/X votes, no totals or category counts, unvoted/removed/out-of-range choices and realtime automatic X updates.');
