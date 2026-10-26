(()=>{
  const form=document.querySelector('#calendarConfigForm'),input=document.querySelector('#googleClientId'),status=document.querySelector('#googleCalendarStatus'),message=document.querySelector('#calendarConfigMessage'),button=document.querySelector('#saveCalendarConfig');
  async function request(options){const r=await fetch('/api/calendar-config',{credentials:'include',cache:'no-store',...options}),data=await r.json();if(!r.ok)throw Error(data.error||'구글 연결 설정을 확인하지 못했어요.');return data}
  request().then(data=>{if(document.activeElement!==input)input.value=data.clientId||'';status.textContent=data.configured?'클라이언트 ID 등록됨 · 실제 연결은 Google Cloud의 권한·원본 설정도 필요합니다.':'연결 대기 · 아래 설정 방법에 따라 클라이언트 ID를 등록해 주세요.'}).catch(e=>status.textContent=e.message);
  form.onsubmit=async e=>{e.preventDefault();button.disabled=true;message.textContent='저장 중…';try{const clientId=input.value.trim();await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId})});message.textContent='저장했어요. 투표 페이지를 새로 열어 구글 캘린더를 연결해 주세요.';status.textContent='클라이언트 ID 등록됨'}catch(e){message.textContent=e.message}finally{button.disabled=false}};
})();
