/* Long press without blocking normal vertical scrolling. */
window.attachAdminLogo=function(logo,onOpen){
  let timer=null,pointer=null,startX=0,startY=0,opened=false;
  const stop=()=>{clearTimeout(timer);timer=null;pointer=null};
  const open=()=>{if(opened||!logo.isConnected)return;opened=true;stop();onOpen()};
  const down=e=>{
    if(e.isPrimary===false||e.button>0)return;
    stop();pointer=e.pointerId;startX=e.clientX;startY=e.clientY;
    timer=setTimeout(open,800);
  };
  const move=e=>{if(pointer!==null&&e.pointerId===pointer&&Math.hypot(e.clientX-startX,e.clientY-startY)>12)stop()};
  const up=e=>{if(e.pointerId===pointer)stop()};
  const key=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
  const context=e=>e.preventDefault();
  const visibility=()=>{if(document.hidden)stop()};
  logo.classList.add('admin-home-logo');logo.setAttribute('role','button');logo.setAttribute('tabindex','0');logo.setAttribute('aria-label','언제봐? 로고, 길게 눌러 관리자 페이지 열기');
  logo.querySelector('img')?.setAttribute('draggable','false');
  logo.addEventListener('pointerdown',down);logo.addEventListener('keydown',key);logo.addEventListener('contextmenu',context);logo.addEventListener('dragstart',context);
  window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerup',up,{passive:true});window.addEventListener('pointercancel',up,{passive:true});window.addEventListener('blur',stop);document.addEventListener('visibilitychange',visibility);
  return()=>{stop();logo.removeEventListener('pointerdown',down);logo.removeEventListener('keydown',key);logo.removeEventListener('contextmenu',context);logo.removeEventListener('dragstart',context);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',visibility)};
};
