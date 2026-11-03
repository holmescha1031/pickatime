import assert from 'node:assert/strict';
import {listGoogle,fetchGoogle,indexEvents,windowFor} from '../assets/calendar-data.mjs';
const calls=[];globalThis.fetch=async(url,options)=>{
 assert.equal(options.headers.Authorization,'Bearer test-memory-token');assert(!url.includes('test-memory-token'));calls.push(url);const u=new URL(url);
 const data=u.pathname.endsWith('calendarList')?(u.searchParams.has('pageToken')?{items:[{id:'work',summary:'Work',timeZone:'Asia/Seoul'}]}:{items:[{id:'primary',primary:true,summary:'Personal'},{id:'x#holiday@group',summary:'Holidays'}],nextPageToken:'next'}):{items:[{summary:'Meeting',start:{dateTime:'2026-12-01T12:00:00+09:00'},end:{dateTime:'2026-12-01T13:00:00+09:00'}},{summary:'All day',start:{date:'2026-12-02'},end:{date:'2026-12-03'}},{summary:'Cancelled',status:'cancelled'},{summary:'Declined',attendees:[{self:true,responseStatus:'declined'}]}]};
 return {ok:true,json:async()=>data};
};
const calendars=await listGoogle('test-memory-token');assert.equal(calendars.length,2);assert(calendars[0].selected);
const events=await fetchGoogle('test-memory-token',[calendars[0]],windowFor('2026-12-01','2026-12-03'));
assert.equal(events.length,2);const days=indexEvents(events,'2026-12-01','2026-12-03');assert.equal(days['2026-12-01'][0].tm,'12:00–13:00');assert.equal(days['2026-12-02'][0].tm,'종일');assert(!days['2026-12-03']);assert(calls.at(-1).includes('singleEvents=true'));
console.log('PASS paginated calendar list, selected calendars, bounded event requests, cancelled/declined filtering, timed/all-day display, token only in Authorization header.');
