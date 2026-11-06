/* Shared pure state helpers: reservations overlay choices without destroying them. */
(function(root){
 function effectiveVotes(votes={},blocked={}){
  const result={};
  for(const [uid,days]of Object.entries(votes||{})){
   result[uid]={};for(const [date,slots]of Object.entries(days||{}))result[uid][date]={...slots};
  }
  for(const [uid,sources]of Object.entries(blocked||{}))for(const b of Object.values(sources||{})){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(b?.date||'')||!['L','D'].includes(b.slot))continue;
   const last=b.allDay&&/^\d{4}-\d{2}-\d{2}$/.test(b.endDate||'')?b.endDate:b.date;
   for(let d=b.date,n=0;d<=last&&n<30;n++,d=new Date(Date.parse(d+'T00:00:00Z')+86400000).toISOString().slice(0,10)){
    result[uid]??={};result[uid][d]??={};for(const slot of b.allDay?['L','D']:[b.slot])result[uid][d][slot]=4;
   }
  }
  return result;
 }
 function cleanDraft(value,start,end,now=Date.now()){
  if(!value||!Number.isFinite(value.at)||value.at>now+60000||now-value.at>86400000)return {};
  const votes={};for(const [d,slots]of Object.entries(value.votes||{})){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d<start||d>end||new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d)continue;
   for(const sl of ['L','D'])if([2,3,4].includes(slots?.[sl])){votes[d]??={};votes[d][sl]=slots[sl];}
  }
  return votes;
 }
 const api={effectiveVotes,cleanDraft};
 if(typeof module!=='undefined')module.exports=api;else root.MeetingState=api;
})(typeof window==='undefined'?globalThis:window);
