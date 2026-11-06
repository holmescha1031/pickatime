const assert=require('node:assert/strict'),{compare}=require('../assets/meeting-list-order');
const row=(id,dateKey,confirmed=false,ended=false)=>({id,title:id,dateKey,confirmed,ended});
const rows=[row('confirmedSoon','2026-11-07',true),row('later','2026-12-01'),row('past','2026-10-01',false,true),row('next','2026-11-08'),row('confirmedLater','2026-12-03',true),row('older','2026-09-01',false,true)];
assert.deepEqual(rows.sort(compare).map(x=>x.id),['next','later','past','older','confirmedSoon','confirmedLater']);
assert(compare(row('a','2026-11-08'),row('b','2026-11-08'))<0);
console.log('PASS: upcoming meetings ordered by date, expired meetings follow, all confirmed meetings last, stable equal-date order.');
