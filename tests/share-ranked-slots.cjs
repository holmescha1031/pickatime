const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
// Reproduce two equally available meals on December 5, followed by three other dates.
const ranked=[['2026-12-05','L',2],['2026-12-05','D',2],['2026-12-08','D',2],['2026-12-27','L',2],['2026-12-29','D',2],['2026-11-28','L',1]].map(([d,sl,count])=>({d,sl,count}));
const data={meta:{expectedCount:2},members:{a:{},b:{}},votes:{a:{'2026-12-05':{L:2}},b:{'2026-12-05':{L:2}}}};
const c={URL,S:data,PUBLIC_SITE_URL:'https://pickatime.xyz/',computeRank:()=>({list:ranked}),effectiveVotes:d=>d.votes,todayStr:()=> '2026-11-25',inMeetingRange:()=>true,normalizeVoteLevel:n=>n,parseYmd:d=>new Date(d+'T12:00:00Z'),pad:n=>String(n).padStart(2,'0'),WD:['일','월','화','수','목','금','토'],SLOT_NAME:{L:'점심',D:'저녁'}};
vm.createContext(c);vm.runInContext(html.slice(html.indexOf('function rankShareState('),html.indexOf('function shareRankStatus(')),c);
const before=JSON.stringify(ranked),state=c.rankShareState(),args=c.rankKakaoTemplateArgs('example','공유 예시',state);
assert.deepEqual(Array.from(state.dates,r=>r.d+'|'+r.sl),ranked.slice(0,5).map(r=>r.d+'|'+r.sl));
assert.equal(args.title1,'12월 5일 (토) 점심');assert.equal(args.title2,'12월 5일 (토) 저녁');assert.equal(args.title5,'12월 29일 (화) 저녁');
for(let i=1;i<=5;i++){assert.equal(args['desc'+i],'2/2명 가능');assert(args['THU'+i].endsWith('/share-all-available.png'));}
assert(state.description.includes('2. 2026.12.05 (토) 저녁'));assert(c.rankKakaoText('공유 예시',state).includes('2. 26.12.05(토) 저녁'));assert(!state.description.includes('11.28'));
for(const count of [0,1,2,3,4,5])assert.equal(c.rankShareState(data,ranked.slice(0,count)).dates.length,count);
const trips=[{d:'2026-12-01',endDate:'2026-12-05',sl:'L',count:2},{d:'2026-12-02',endDate:'2026-12-06',sl:'L',count:2}];
assert.deepEqual(Array.from(c.rankShareState(data,trips).dates,r=>[r.d,r.endDate]),trips.map(r=>[r.d,r.endDate]));assert.equal(JSON.stringify(ranked),before);
console.log('PASS: shared top five exactly match screen order, same-day lunch and dinner retained, availability thumbnails/counts and text match, 0..5 templates and trip windows retained. No real messages sent.');
