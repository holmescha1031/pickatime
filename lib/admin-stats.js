function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value}
function bounds(meta){
 function date(v,last){if(/^\d{4}-(0[1-9]|1[0-2])$/.test(v||'')){const [y,m]=v.split('-').map(Number);return v+'-'+(last?String(new Date(Date.UTC(y,m,0)).getUTCDate()).padStart(2,'0'):'01')}return validDate(v)?v:null}
 const start=date(meta?.start,false),end=date(meta?.end,true);return start&&end&&start<=end?{start,end}:null;
}
const level=n=>n===1||n===2?2:n===3?3:0;
const kstDay=ms=>new Date(ms+9*3600000).toISOString().slice(0,10);
function summarize(records,{days='all',now=Date.now()}={}){
 const today=kstDay(now),n=days==='all'?null:Number(days),cutoff=n?new Date(new Date(today+'T00:00:00Z').getTime()-(n-1)*86400000).toISOString().slice(0,10):null;
 const rooms=[],unique=new Set();let participants=0,voters=0,stickers=0,normal=0,uncertain=0,seats=0,fullyVoted=0,active=0;
 for(const record of records){
  if(record.deleted||!record.data?.meta)continue;const data=record.data,meta=data.meta,range=bounds(meta);if(!range)continue;
  const createdAt=Number(meta.createdAt);if(!Number.isFinite(createdAt)||createdAt<0||!Number.isFinite(new Date(createdAt).getTime()))continue;
  if(cutoff!==null&&kstDay(createdAt)<cutoff)continue;
  const ids=Object.keys(data.members||{}).filter(id=>/^kakao_\d+$/.test(id)&&data.members[id]&&typeof data.members[id]==='object');
  const expected=Number.isInteger(meta.expectedCount)&&meta.expectedCount>=2&&meta.expectedCount<=100?meta.expectedCount:null,target=Math.max(expected||0,ids.length);
  let voted=0,roomStickers=0;const rank={};
  for(const id of ids){unique.add(id);let count=0;for(const [date,slots] of Object.entries(data.votes?.[id]||{})){
    if(!validDate(date)||date<range.start||date>range.end||!slots||typeof slots!=='object')continue;
    for(const slot of ['L','D']){const l=level(slots[slot]);if(!l)continue;count++;stickers++;if(l===2)normal++;else uncertain++;
      if(date>=today){const r=rank[date+'|'+slot]??={date,slot,count:0,score:0};r.count++;r.score+=l===2?2:1}
    }
   }if(count)voted++;roomStickers+=count;
  }
  const best=Object.values(rank).sort((a,b)=>b.count-a.count||b.score-a.score||a.date.localeCompare(b.date)||['L','D'].indexOf(a.slot)-['L','D'].indexOf(b.slot))[0]||null;
  participants+=ids.length;voters+=voted;seats+=target;if(expected&&voted>=target)fullyVoted++;if(range.end>=today)active++;
  rooms.push({title:typeof meta.title==='string'?meta.title.slice(0,100):'이름 없는 모임',createdAt,start:range.start,end:range.end,expected,target,participants:ids.length,voters:voted,stickers:roomStickers,rate:target?Math.round(voted/target*100):0,best});
 }
 rooms.sort((a,b)=>b.createdAt-a.createdAt);
 const chartDays=n||30,byDay={};for(let i=chartDays-1;i>=0;i--){const day=new Date(new Date(today+'T00:00:00Z').getTime()-i*86400000).toISOString().slice(0,10);byDay[day]=0}
 for(const room of rooms){const day=kstDay(room.createdAt);if(day in byDay)byDay[day]++}
 return {generatedAt:now,days,definitions:{voted:'투표 기간 안에 스티커를 1개 이상 붙인 참여자',seats:'각 모임의 전체 인원과 실제 참여 인원 중 큰 값의 합계',unique:'모임 간 중복을 제외한 카카오 계정 수'},totals:{polls:rooms.length,uniqueUsers:unique.size,participants,voters,stickers,seats,participationRate:seats?Math.round(voters/seats*100):0,fullyVoted,active,ended:rooms.length-active,withoutVotes:rooms.filter(r=>!r.voters).length,normal,uncertain},daily:Object.entries(byDay).map(([date,count])=>({date,count})),rooms};
}
module.exports={summarize,bounds,validDate,kstDay};
