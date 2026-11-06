const assert=require('node:assert/strict'),Trip=require('../assets/trip-votes'),{effectiveVotes}=require('../assets/meeting-state');
const start='2026-12-01',end='2026-12-10',members={kakao_1:{},kakao_2:{}},votes={kakao_1:{},kakao_2:{}};
for(let i=0;i<10;i++){const d=Trip.addDays(start,i);votes.kakao_1[d]={L:2,D:2};votes.kakao_2[d]={L:2,D:2};}
votes.kakao_2['2026-12-05']={L:4,D:4};votes.kakao_1['2026-12-02']={L:3,D:3};
let data={meta:{meetingType:'trip',tripDays:5},members,votes};const raw=JSON.stringify(votes);let ranked=Trip.rank(data,start,{start,end});
assert.equal(ranked.list.length,6);assert.equal(ranked.list[0].d,'2026-12-06');assert.equal(ranked.list[0].endDate,'2026-12-10');assert.equal(ranked.list[0].count,2);assert.equal(ranked.list.at(-1).unavailable,1);assert.equal(JSON.stringify(votes),raw);
assert.equal(Trip.dayLevel({L:2}),0);assert.equal(Trip.dayLevel({L:2,D:3}),3);assert.equal(Trip.dayLevel({L:4}),4);
delete votes.kakao_2['2026-12-10'];ranked=Trip.rank(data,start,{start,end});assert.equal(ranked.list.find(r=>r.d==='2026-12-06').lv.kakao_2,undefined);
const booking=Trip.booking({date:start,endDate:'2026-12-05',slot:'L'}),blocked={kakao_1:{source:booking}};
const merged=effectiveVotes(votes,blocked);for(let i=0;i<5;i++)assert.deepEqual(merged.kakao_1[Trip.addDays(start,i)],{L:4,D:4});assert.equal(merged.kakao_1['2026-12-06'].D,2);
assert(Trip.overlap(booking,{date:'2026-12-03',slot:'D'}));assert(!Trip.overlap(booking,{date:'2026-12-06',slot:'D'}));assert(Trip.contains(booking,'2026-12-05','D'));assert(!Trip.contains({date:start,slot:'L'},start,'D'));
assert.equal(Trip.addDays('2028-02-28',2),'2028-03-01');assert.equal(Trip.addDays('2026-12-30',4),'2027-01-03');
console.log('PASS: sliding five-day windows, impossible/missing/maybe aggregation, full-day reservations, overlap boundaries, leap years and retained manual choices.');
