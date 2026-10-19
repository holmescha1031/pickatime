/* Track acknowledged writes separately from optimistic sticker rendering. */
window.createVoteSaveTracker=function(onChange=()=>{}){
  const states=new Map();let revision=0;
  const state=key=>{if(!states.has(key))states.set(key,{pending:new Set(),failed:new Map(),latest:new Map(),saved:false});return states.get(key)};
  const info=key=>{const s=state(key);return {pending:s.pending.size,failed:s.failed.size,saved:s.saved,rootBlocked:[...s.pending].some(t=>t.root)||[...s.failed.values()].some(t=>t.root)}};
  const save=(key,path,write,{root=false}={})=>{
    const s=state(key),token={path,write,root,revision:++revision};
    s.latest.set(path,token.revision);s.failed.delete(path);s.pending.add(token);onChange(key,info(key));
    const promise=Promise.resolve().then(write).then(result=>{
      s.saved=true;return {ok:true,result};
    },error=>{
      if(s.latest.get(path)===token.revision)s.failed.set(path,token);
      return {ok:false,error};
    }).finally(()=>{s.pending.delete(token);onChange(key,info(key))});
    token.promise=promise;return promise;
  };
  const settle=async key=>{const s=state(key);while(s.pending.size)await Promise.all([...s.pending].map(t=>t.promise));return info(key)};
  const retry=async key=>{const s=state(key);await settle(key);const errors=[...s.failed.values()];await Promise.all(errors.map(t=>save(key,t.path,t.write,{root:t.root})));return settle(key)};
  return {info,save,settle,retry};
};
