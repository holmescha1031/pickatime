/* Desktop drag; mobile horizontal swipe or press-and-hold to paint while preserving vertical scrolling. */
window.attachVoteDrag=function(root,apply){
  let gesture=null,hold=null,suppressUntil=0;
  const valid=el=>{const b=el?.closest?.('.half');return b&&root.contains(b)&&!b.disabled?b:null};
  const paint=b=>{if(!b||!gesture||gesture.seen.has(b))return;gesture.seen.add(b);apply(b,gesture.level)};
  const begin=()=>{if(!gesture||gesture.active)return;gesture.active=true;clearTimeout(hold);paint(gesture.first);suppressUntil=Date.now()+700};
  const trace=(x,y)=>{
    const g=gesture;if(!g)return;
    const n=Math.max(1,Math.ceil(Math.hypot(x-g.x,y-g.y)/6));
    for(let i=1;i<=n;i++)paint(valid(document.elementFromPoint(g.x+(x-g.x)*i/n,g.y+(y-g.y)*i/n)));
    g.x=x;g.y=y;
  };
  const stop=()=>{clearTimeout(hold);if(gesture?.active)suppressUntil=Date.now()+700;gesture=null};
  const start=(b,x,y,type)=>{stop();suppressUntil=0;gesture={first:b,x,y,sx:x,sy:y,type,active:false,seen:new Set(),level:((Number(b.dataset.l)||0)+1)%4}};
  const pointerDown=e=>{if(e.pointerType==='touch'||e.button!==0)return;const b=valid(e.target);if(!b)return;start(b,e.clientX,e.clientY,'pointer');begin();e.preventDefault()};
  const pointerMove=e=>{if(gesture?.type!=='pointer')return;trace(e.clientX,e.clientY);e.preventDefault()};
  const pointerUp=()=>{if(gesture?.type==='pointer')stop()};
  const touchStart=e=>{if(e.touches.length!==1){stop();return}const b=valid(e.target);if(!b)return;const t=e.touches[0];start(b,t.clientX,t.clientY,'touch');hold=setTimeout(begin,260)};
  const touchMove=e=>{
    if(gesture?.type!=='touch')return;
    if(e.touches.length!==1){stop();return}
    const t=e.touches[0],dx=t.clientX-gesture.sx,dy=t.clientY-gesture.sy;
    if(!gesture.active){
      if(Math.abs(dy)>8&&Math.abs(dy)>=Math.abs(dx)){stop();return}
      if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy))begin();else return;
    }
    if(e.cancelable)e.preventDefault();trace(t.clientX,t.clientY);
  };
  const touchEnd=()=>{if(gesture?.type==='touch')stop()};
  const click=e=>{if(valid(e.target)&&Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation()}};
  const context=e=>{if(valid(e.target))e.preventDefault()};
  const hidden=()=>{if(document.hidden)stop()};
  root.addEventListener('pointerdown',pointerDown);
  document.addEventListener('pointermove',pointerMove,{passive:false});
  document.addEventListener('pointerup',pointerUp);document.addEventListener('pointercancel',pointerUp);
  root.addEventListener('touchstart',touchStart,{passive:true});
  root.addEventListener('touchmove',touchMove,{passive:false});
  document.addEventListener('touchend',touchEnd);document.addEventListener('touchcancel',touchEnd);
  root.addEventListener('click',click,true);root.addEventListener('contextmenu',context);
  document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',stop);
  return ()=>{stop();root.removeEventListener('pointerdown',pointerDown);document.removeEventListener('pointermove',pointerMove);document.removeEventListener('pointerup',pointerUp);document.removeEventListener('pointercancel',pointerUp);root.removeEventListener('touchstart',touchStart);root.removeEventListener('touchmove',touchMove);document.removeEventListener('touchend',touchEnd);document.removeEventListener('touchcancel',touchEnd);root.removeEventListener('click',click,true);root.removeEventListener('contextmenu',context);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',stop)};
};
