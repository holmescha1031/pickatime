(function(root){
 function compare(a,b){
  return Number(Boolean(a.confirmed))-Number(Boolean(b.confirmed))||Number(Boolean(a.ended))-Number(Boolean(b.ended))||
   (a.ended&&b.ended?b.dateKey.localeCompare(a.dateKey):a.dateKey.localeCompare(b.dateKey))||a.title.localeCompare(b.title)||a.id.localeCompare(b.id);
 }
 const api={compare};if(typeof module!=='undefined')module.exports=api;else root.MeetingListOrder=api;
})(typeof window==='undefined'?globalThis:window);
