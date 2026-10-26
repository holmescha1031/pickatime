import ICAL from './vendor/ical/module.mjs';

const pad=n=>String(n).padStart(2,'0');
const dateString=t=>`${t.year}-${pad(t.month)}-${pad(t.day)}`;
const dayMs=86400000;
const formatters=new Map();
function parts(ms,zone='Asia/Seoul'){
  if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
  return Object.fromEntries(formatters.get(zone).formatToParts(new Date(ms)).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
}
function wallTime(t,zone='Asia/Seoul'){
  const wall=Date.UTC(t.year,t.month-1,t.day,t.hour||0,t.minute||0,t.second||0);let ms=wall;
  for(let i=0;i<4;i++){const p=parts(ms,zone),shift=wall-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);ms+=shift;if(!shift)return ms}
  throw Error('일정의 시간대를 확인할 수 없어요. UTC 시간대의 파일로 다시 내보내 주세요.');
}
export function windowFor(start,end){return {from:Date.parse(start+'T00:00:00+09:00'),to:Date.parse(end+'T00:00:00+09:00')+dayMs}}
function nextDate(date){return new Date(Date.parse(date+'T00:00:00Z')+dayMs).toISOString().slice(0,10)}
function relevant(e,range){return e.a?e.s<new Date(range.to+9*3600000).toISOString().slice(0,10)&&e.e>new Date(range.from+9*3600000).toISOString().slice(0,10):e.s<range.to&&e.e>range.from}
function timeMs(t,prop,fallbackZone){
  const tzid=prop?.getParameter('tzid');
  if(t.zone?.tzid==='UTC')return t.toUnixTime()*1000;
  if(t.zone?.tzid&&t.zone.tzid!=='floating')return t.toUnixTime()*1000;
  return wallTime(t,tzid||fallbackZone||'Asia/Seoul');
}
export function parseIcs(text,range){
  if(text.length>2*1024*1024)throw Error('캘린더 파일은 2MB 이하로 선택해 주세요.');
  if(!/^\uFEFF?BEGIN:VCALENDAR\s*$/im.test(text)||!/^END:VCALENDAR\s*$/im.test(text))throw Error('.ics 캘린더 파일인지 확인해 주세요.');
  const root=new ICAL.Component(ICAL.parse(text.replace(/^\uFEFF/,'')));
  const components=root.getAllSubcomponents('vevent');if(components.length>5000)throw Error('일정이 너무 많아요. 필요한 캘린더만 내보내 주세요.');
  // Isolate VTIMEZONE definitions from previously imported files.
  ICAL.TimezoneService.reset();
  for(const zone of root.getAllSubcomponents('vtimezone')){const id=zone.getFirstPropertyValue('tzid');if(id)ICAL.TimezoneService.register(new ICAL.Timezone({component:zone,tzid:id}))}
  const fallback=root.getFirstPropertyValue('x-wr-timezone')||'Asia/Seoul';
  const events=components.map(component=>new ICAL.Event(component));const masters=new Map();
  for(const event of events)if(!event.isRecurrenceException())masters.set(event.uid,event);
  for(const event of events)if(event.isRecurrenceException()){if(!event.startDate&&event.component.getFirstPropertyValue('status')==='CANCELLED')event.startDate=event.recurrenceId.clone();if(masters.has(event.uid))masters.get(event.uid).relateException(event);}
  const out=[],seen=new Set();let steps=0;
  function add(item,start,end){
    const component=item.component;
    if(component.getFirstPropertyValue('status')==='CANCELLED'||component.getFirstPropertyValue('transp')==='TRANSPARENT')return;
    if(!start||!end)throw Error('시작 또는 종료 시간이 없는 일정이 있어요. 파일을 다시 내보내 주세요.');
    const t=String(item.summary||'일정').slice(0,150);
    const e=start.isDate?{t,a:true,s:dateString(start),e:dateString(end)}:{t,s:timeMs(start,component.getFirstProperty('dtstart'),fallback),e:timeMs(end,component.getFirstProperty('dtend')||component.getFirstProperty('dtstart'),fallback)};
    if(e.a&&e.e<=e.s)e.e=nextDate(e.s);
    if(!e.a&&(!Number.isFinite(e.s)||!Number.isFinite(e.e)||e.e<=e.s))return;
    const key=[e.t,e.a,e.s,e.e].join('|');if(relevant(e,range)&&!seen.has(key)){seen.add(key);out.push(e)}
  }
  for(const event of events){
    if(event.isRecurrenceException()){if(!masters.has(event.uid))add(event,event.startDate,event.endDate);continue}
    if(!event.isRecurring()){add(event,event.startDate,event.endDate);continue}
    const iterator=event.iterator();let occurrence;
    while((occurrence=iterator.next())){
      if(++steps>50000)throw Error('반복 일정이 너무 많아요. 가져올 기간을 줄여 내보내 주세요.');
      if(Date.UTC(occurrence.year,occurrence.month-1,occurrence.day)>range.to+2*dayMs)break;
      const details=event.getOccurrenceDetails(occurrence);add(details.item,details.startDate,details.endDate);
    }
    // Moved exceptions can land in this window even if their original date is outside it.
    for(const exception of Object.values(event.exceptions))add(exception,exception.startDate,exception.endDate);
  }
  return out.sort((a,b)=>String(a.s).localeCompare(String(b.s)));
}
async function googleGet(path,token){
  const response=await fetch('https://www.googleapis.com/calendar/v3/'+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(response.status===401?'구글 연결이 만료됐어요. 다시 연결해 주세요.':response.status===403?'캘린더 읽기 권한을 허용해 주세요. Google Calendar API가 활성화되어 있는지도 확인해 주세요.':'구글 캘린더를 불러오지 못했어요. 다시 시도해 주세요.');
  return response.json();
}
export async function listGoogle(token){
  const all=[];let page='';let pages=0;
  do{if(++pages>20)throw Error('캘린더가 너무 많아요. 파일로 내보내 가져와 주세요.');const q=new URLSearchParams({maxResults:'250',minAccessRole:'reader'});if(page)q.set('pageToken',page);const data=await googleGet('users/me/calendarList?'+q,token);all.push(...(data.items||[]));page=data.nextPageToken}while(page);
  return all.filter(c=>!c.deleted&&!/#(holiday|contacts)@/.test(c.id)).map(c=>({id:c.id,name:c.summaryOverride||c.summary||'캘린더',zone:c.timeZone||'Asia/Seoul',selected:c.primary||c.selected!==false&&!c.hidden}));
}
export async function fetchGoogle(token,calendars,range){
  const out=[];let next=0;
  await Promise.all(Array.from({length:Math.min(3,calendars.length)},async()=>{while(next<calendars.length){const cal=calendars[next++];let page='',pages=0;do{
    if(++pages>20)throw Error('일정이 너무 많아요. 캘린더 파일로 가져와 주세요.');
    const q=new URLSearchParams({singleEvents:'true',orderBy:'startTime',maxResults:'2500',timeMin:new Date(range.from).toISOString(),timeMax:new Date(range.to).toISOString(),fields:'nextPageToken,items(summary,start,end,status,transparency,attendees(self,responseStatus))'});if(page)q.set('pageToken',page);
    const data=await googleGet('calendars/'+encodeURIComponent(cal.id)+'/events?'+q,token);
    for(const item of data.items||[]){
      if(item.status==='cancelled'||item.transparency==='transparent'||item.attendees?.some(a=>a.self&&a.responseStatus==='declined'))continue;
      const t=String(item.summary||'일정').slice(0,150);let e;
      if(item.start?.date)e={t,a:true,s:item.start.date,e:item.end?.date||nextDate(item.start.date)};
      else if(item.start?.dateTime&&item.end?.dateTime){const parse=(value,zone)=>{if(/(?:Z|[+-]\d\d:\d\d)$/.test(value))return Date.parse(value);const m=value.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?/);if(!m)throw Error('일정 시간을 읽지 못했어요.');return wallTime({year:+m[1],month:+m[2],day:+m[3],hour:+m[4],minute:+m[5],second:+m[6]||0},zone||cal.zone)};e={t,s:parse(item.start.dateTime,item.start.timeZone),e:parse(item.end.dateTime,item.end.timeZone)}}
      if(e&&relevant(e,range))out.push(e);if(out.length>20000)throw Error('일정이 너무 많아요. 가져올 캘린더 수를 줄여 주세요.');
    }page=data.nextPageToken;
  }while(page)}}));return out;
}
export function indexEvents(events,start,end){
  const idx={},range=windowFor(start,end),push=(date,item)=>(idx[date]??=[]).push(item);
  for(const ev of events){
    if(!relevant(ev,range))continue;
    const first=ev.a?Date.parse(ev.s+'T00:00:00+09:00'):Math.floor((ev.s+9*3600000)/dayMs)*dayMs-9*3600000;
    const last=ev.a?Date.parse(ev.e+'T00:00:00+09:00'):ev.e;
    for(let ms=Math.max(range.from,first);ms<Math.min(range.to,last);ms+=dayMs){
      const p=parts(ms),date=dateString(p);
      if(ev.a){if(date>=ev.s&&date<ev.e)push(date,{t:ev.t,a:true,L:true,D:true,tm:'종일',k:-1});continue}
      if(ev.s>=ms+dayMs||ev.e<=ms)continue;
      const a=Math.max(0,(ev.s-ms)/60000),b=Math.min(1440,(ev.e-ms)/60000),st=parts(ev.s),en=parts(ev.e);
      const hm=p=>pad(p.hour)+':'+pad(p.minute);
      push(date,{t:ev.t,L:a<15*60&&b>11*60,D:a<24*60&&b>17*60,tm:(ev.s<ms?'이어서':hm(st))+'–'+(ev.e>=ms+dayMs?'24:00':hm(en)),k:a});
    }
  }
  for(const date in idx)idx[date].sort((a,b)=>a.k-b.k);return idx;
}
