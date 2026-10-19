/* Only copy the signed-in person's selections into empty, overlapping future slots. */
window.VoteTransfer={
  plan(source,target,votes,current,today){
    const month=/^\d{4}-(0[1-9]|1[0-2])$/;
    if(!source||!target||![source.start,source.end,target.start,target.end].every(v=>typeof v==='string'&&month.test(v)))return {cells:[],start:null,end:null};
    const start=[source.start,target.start].sort().at(-1),end=[source.end,target.end].sort()[0],cells=[];
    if(start>end)return {cells,start,end};
    for(const [date,day] of Object.entries(votes||{})){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<today||date.slice(0,7)<start||date.slice(0,7)>end||!day||typeof day!=='object')continue;
      const parsed=new Date(date+'T12:00:00Z');
      if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)continue;
      for(const slot of ['L','D']){
        const raw=day[slot],level=raw===1||raw===2?2:raw===3?3:0;
        const old=current?.[date]?.[slot];
        if(level&&(old===undefined||old===null||old===0))cells.push({date,slot,level});
      }
    }
    cells.sort((a,b)=>a.date.localeCompare(b.date)||['L','D'].indexOf(a.slot)-['L','D'].indexOf(b.slot));
    return {cells,start,end};
  },
  async run(cells,{saveIfEmpty,isActive=()=>true,onProgress=()=>{},concurrency=4}){
    let next=0,processed=0,added=0,skipped=0;const errors=[],results=[];
    const worker=async()=>{
      while(next<cells.length&&isActive()){
        const cell=cells[next++];
        try{const result=await saveIfEmpty(cell);results.push({cell,result});if(result.committed)added++;else skipped++}
        catch(error){errors.push({cell,error})}
        processed++;onProgress({processed,total:cells.length,added,skipped,failed:errors.length});
      }
    };
    await Promise.all(Array.from({length:Math.min(cells.length,Math.max(1,Math.min(8,concurrency)))},worker));
    return {added,skipped,failed:errors.length,processed,aborted:processed<cells.length,results,errors};
  }
};
