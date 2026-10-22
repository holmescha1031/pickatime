/* Keep native scrolling and short taps; touch events cover mobile webviews. */
window.attachAdminLogo=function(logo,onOpen){
  let timer=null,active=null,startX=0,startY=0,suppressClick=false,detached=false;
  const listeners=[];
  const listen=(target,name,fn,options)=>{target.addEventListener(name,fn,options);listeners.push(()=>target.removeEventListener(name,fn,options))};
  const stop=()=>{clearTimeout(timer);timer=null;active=null};
  const open=()=>{stop();if(detached||!logo.isConnected)return;suppressClick=true;onOpen()};
  const start=(id,x,y)=>{stop();suppressClick=false;active=id;startX=x;startY=y;timer=setTimeout(open,800)};
  const move=(id,x,y)=>{if(active===id&&Math.hypot(x-startX,y-startY)>12)stop()};
  if('ontouchstart' in window||navigator.maxTouchPoints>0){
    listen(logo,'touchstart',e=>{if(e.touches.length!==1){stop();return}const t=e.touches[0];start(t.identifier,t.clientX,t.clientY)},{passive:true});
    listen(window,'touchmove',e=>{const t=Array.from(e.touches).find(t=>t.identifier===active);if(t)move(t.identifier,t.clientX,t.clientY);else stop()},{passive:true});
    listen(window,'touchend',stop,{passive:true});
    listen(window,'touchcancel',stop,{passive:true});
  }else{
    listen(logo,'pointerdown',e=>{if(e.isPrimary===false||e.button>0)return;start(e.pointerId,e.clientX,e.clientY)});
    listen(window,'pointermove',e=>move(e.pointerId,e.clientX,e.clientY),{passive:true});
    listen(window,'pointerup',stop,{passive:true});
    listen(window,'pointercancel',stop,{passive:true});
  }
  listen(logo,'click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false}},true);
  listen(logo,'keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
  listen(logo,'contextmenu',e=>e.preventDefault());
  listen(logo,'dragstart',e=>e.preventDefault());
  listen(window,'blur',stop);
  listen(document,'visibilitychange',()=>{if(document.hidden)stop()});
  logo.classList.add('admin-home-logo');
  logo.setAttribute('tabindex','0');
  if(!logo.hasAttribute('href'))logo.setAttribute('role','button');
  logo.setAttribute('aria-label','언제봐? 로고, 길게 눌러 관리자 페이지 열기');
  logo.querySelector('img')?.setAttribute('draggable','false');
  return()=>{detached=true;stop();listeners.forEach(remove=>remove())};
};
