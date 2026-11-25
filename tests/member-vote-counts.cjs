const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const data={meta:{},votes:{a:{'2026-12-04':{D:4},'2026-12-06':{L:4,D:4},'2026-12-20':{L:4},'2026-12-25':{L:4,D:4},'2026-12-31':{D:4}}},blocked:{}};
const c={S:data,window:{TripVotes:require('../assets/trip-votes'),MeetingState:require('../assets/meeting-state')},todayStr:()=> '2026-11-25',inMeetingRange:d=>d>='2026-12-01'&&d<='2026-12-31'};
vm.createContext(c);vm.runInContext(html.slice(html.indexOf('const LEVEL_TEXT='),html.indexOf('function renderCalendar('))+html.slice(html.indexOf('function myCount('),html.indexOf('/* Personal calendar details')),c);
const counts=id=>JSON.parse(JSON.stringify(c.myVoteCounts(id)));
assert.deepEqual(counts('a'),{available:0,maybe:0,unavailable:7,total:7});assert.equal(c.myCount('a'),7);
data.votes={...data.votes,a:{...data.votes.a,'2026-12-03':{D:3},'2026-12-07':{D:1},'2026-12-11':{D:2},'2026-12-12':{L:2,D:2},'2026-12-13':{L:2,D:2},'2026-12-18':{D:2},'2026-12-19':{L:2,D:2},'2026-11-20':{L:2},'2027-01-01':{L:2},'2026-12-02':{L:0,D:9}}};
assert.deepEqual(counts('a'),{available:9,maybe:1,unavailable:7,total:17});assert.equal(c.myCount('a'),17);
// Automatic X replaces a positive selection once, even when bookings overlap; cancellation restores it.
const raw=JSON.stringify(data.votes);data.blocked={a:{one:{date:'2026-12-07',slot:'D'},two:{date:'2026-12-07',slot:'D'}}};
assert.deepEqual(counts('a'),{available:8,maybe:1,unavailable:8,total:17});data.blocked={};assert.equal(counts('a').available,9);assert.equal(JSON.stringify(data.votes),raw);
assert.deepEqual(counts('new'),{available:0,maybe:0,unavailable:0,total:0});
data.meta={meetingType:'trip'};data.votes={a:{'2026-12-01':{L:2,D:2},'2026-12-02':{L:2,D:3},'2026-12-03':{L:4,D:4},'2026-12-04':{L:2}}};
assert.deepEqual(counts('a'),{available:1,maybe:1,unavailable:1,total:3});assert.equal(c.myCount('a'),3);
console.log('PASS: separate available/maybe/impossible counts, X-only seven-cell regression, legacy values, date bounds, automatic X deduplication and restoration, empty participants and whole-day trip counts.');
