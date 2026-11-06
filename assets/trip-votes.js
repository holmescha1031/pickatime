(function(root){
 const addDays=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
 const trip=meta=>meta?.meetingType==='trip';
 const duration=meta=>Number.isSafeInteger(meta?.tripDays)&&meta.tripDays>=2&&meta.tripDays<=30?meta.tripDays:2;
 function dayLevel(slots){const levels=['L','D'].map(s=>slots?.[s]===1?2:slots?.[s]);if(levels.includes(4))return 4;if(!levels.every(l=>l===2||l===3))return 0;return levels.includes(3)?3:2;}
 function rank(data,today,bounds,votes=data.votes||{}){
  const ids=Object.keys(data.members||{}),list=[],days=duration(data.meta),first=bounds.start<today?today:bounds.start;
  for(let start=first;addDays(start,days-1)<=bounds.end;start=addDays(start,1)){
   const endDate=addDays(start,days-1),row={d:start,endDate,sl:'L',count:0,unavailable:0,score:0,lv:{}};
   for(const uid of ids){let missing=false,maybe=false,blocked=false;
    for(let d=start;d<=endDate;d=addDays(d,1)){const level=dayLevel(votes[uid]?.[d]);if(level===4)blocked=true;else if(!level)missing=true;else if(level===3)maybe=true;}
    const level=blocked?4:missing?0:maybe?3:2;
    if(level){row.lv[uid]=level;if(level===4){row.unavailable++;row.score-=2}else{row.count++;row.score+=level===2?2:1;}}
   }
   if(row.count)list.push(row);
  }
  list.sort((a,b)=>a.unavailable-b.unavailable||b.count-a.count||b.score-a.score||a.d.localeCompare(b.d));return {ids,list};
 }
 function booking(confirmed){return confirmed?.endDate?{date:confirmed.date,endDate:confirmed.endDate,slot:'L',allDay:true}:{date:confirmed.date,slot:confirmed.slot};}
 const contains=(b,date,slot)=>!!b&&date>=b.date&&date<=(b.endDate||b.date)&&(b.allDay||b.slot===slot);
 const overlap=(a,b)=>a.date<=(b.endDate||b.date)&&b.date<=(a.endDate||a.date)&&(a.allDay||b.allDay||a.slot===b.slot);
 const api={addDays,trip,duration,dayLevel,rank,booking,contains,overlap};if(typeof module!=='undefined')module.exports=api;else root.TripVotes=api;
})(typeof window==='undefined'?globalThis:window);
