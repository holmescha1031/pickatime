/* Tap cycles ordinary votes. A still 600 ms hold paints unavailable (4); scroll stays native. */
window.attachVoteDrag=function(root,apply,nextLevel=level=>Number(level)===2?3:[3,4].includes(Number(level))?0:2){
  let gesture=null,hold=null,suppressUntil=0;
  const valid=el=>{const b=el?.closest?.('.half');return b&&root.contains(b)&&!b.disabled?b:null};
  const paint=b=>{if(!b||!gesture||gesture.seen.has(b))return;gesture.seen.add(b);apply(b,gesture.level,gesture.method)};
  const begin=(longPress=false)=>{if(!gesture||gesture.active)return;gesture.active=true;clearTimeout(hold);if(longPress){gesture.level=Number(gesture.first.dataset.l)===4?0:4;gesture.method='long_press'}paint(gesture.first);suppressUntil=Date.now()+700};
  const trace=(x,y)=>{
    const g=gesture;if(!g)return;
    const n=Math.max(1,Math.ceil(Math.hypot(x-g.x,y-g.y)/6));
    for(let i=1;i<=n;i++)paint(valid(document.elementFromPoint(g.x+(x-g.x)*i/n,g.y+(y-g.y)*i/n)));
    g.x=x;g.y=y;
  };
  const stop=()=>{clearTimeout(hold);if(gesture?.active)suppressUntil=Date.now()+700;gesture=null};
  const start=(b,x,y,type)=>{stop();suppressUntil=0;gesture={first:b,x,y,sx:x,sy:y,type,active:false,seen:new Set(),level:nextLevel(b.dataset.l),method:'drag'};hold=setTimeout(()=>begin(true),600)};
  const pointerDown=e=>{if(e.pointerType==='touch'||e.button!==0)return;const b=valid(e.target);if(!b)return;start(b,e.clientX,e.clientY,'pointer')};
  const pointerMove=e=>{if(gesture?.type!=='pointer')return;if(!gesture.active){if(Math.hypot(e.clientX-gesture.sx,e.clientY-gesture.sy)<=8)return;begin()}trace(e.clientX,e.clientY);e.preventDefault()};
  const pointerUp=()=>{if(gesture?.type==='pointer')stop()};
  const touchStart=e=>{if(e.touches.length!==1){stop();return}const b=valid(e.target);if(!b)return;const t=e.touches[0];start(b,t.clientX,t.clientY,'touch')};
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
  const key=e=>{const b=valid(e.target);if(!b||!e.shiftKey||!['Enter',' '].includes(e.key))return;e.preventDefault();if(e.repeat)return;apply(b,Number(b.dataset.l)===4?0:4,'keyboard')};
  const hidden=()=>{if(document.hidden)stop()};
  root.addEventListener('pointerdown',pointerDown);
  document.addEventListener('pointermove',pointerMove,{passive:false});
  document.addEventListener('pointerup',pointerUp);document.addEventListener('pointercancel',pointerUp);
  root.addEventListener('touchstart',touchStart,{passive:true});
  root.addEventListener('touchmove',touchMove,{passive:false});
  document.addEventListener('touchend',touchEnd);document.addEventListener('touchcancel',touchEnd);
  root.addEventListener('click',click,true);root.addEventListener('contextmenu',context);root.addEventListener('keydown',key);
  document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',stop);
  return ()=>{stop();root.removeEventListener('pointerdown',pointerDown);document.removeEventListener('pointermove',pointerMove);document.removeEventListener('pointerup',pointerUp);document.removeEventListener('pointercancel',pointerUp);root.removeEventListener('touchstart',touchStart);root.removeEventListener('touchmove',touchMove);document.removeEventListener('touchend',touchEnd);document.removeEventListener('touchcancel',touchEnd);root.removeEventListener('click',click,true);root.removeEventListener('contextmenu',context);root.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',stop)};
};
