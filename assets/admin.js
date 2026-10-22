(()=>{
 const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),num=n=>Number(n||0).toLocaleString('ko-KR');let request=0,loading=false,authorized=false;
 async function api(url,options){const r=await fetch(url,{credentials:'include',cache:'no-store',...options});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||'요청을 처리하지 못했어요.'),{status:r.status,accountId:data.accountId});return data}
 function gate(error){authorized=false;$('#dashboard').hidden=true;$('#gate').hidden=false;$('#gate').innerHTML=error.status===401?'<h1>관리자 로그인</h1><p>관리자 카카오 계정으로 로그인해 주세요.</p><a class="btn primary" href="./?admin=1">카카오로 로그인</a>':`<h1>접근할 수 없어요</h1><p>${esc(error.message)}</p>${error.accountId?`<p class="muted">현재 계정: ${esc(error.accountId)}</p>`:''}<a class="btn" href="./">서비스로 돌아가기</a>`}
 function render(data){
  const t=data.totals;$('#cards').innerHTML=[['생성된 모임',num(t.polls),'진행 중 '+num(t.active)+'개 · 기간 종료 '+num(t.ended)+'개'],['이용한 계정',num(t.uniqueUsers),'여러 모임의 중복 계정 제외'],['투표 참여',num(t.voters)+' / '+num(t.seats),'전체 인원 대비 '+t.participationRate+'%'],['모두 투표한 모임',num(t.fullyVoted),'스티커 총 '+num(t.stickers)+'개']].map(([label,value,detail])=>`<article class="card"><span class="label">${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join('');
  const daily=data.daily,max=Math.max(1,...daily.map(d=>d.count));$('#chartTitle').textContent='최근 '+daily.length+'일 모임 생성';$('#chart').style.gridTemplateColumns=`repeat(${daily.length},minmax(0,1fr))`;$('#chart').innerHTML=daily.map(d=>`<div class="bar" title="${d.date} · ${d.count}개"><span style="height:${Math.max(1,d.count/max*100)}%"></span></div>`).join('');$('#chart').setAttribute('aria-label',daily.map(d=>d.date+' '+d.count+'개').join(', '));$('#chartLabels').innerHTML=`<span>${daily[0]?.date||''}</span><span>${daily.at(-1)?.date||''}</span>`;
  $('#stickerTotal').textContent='총 '+num(t.stickers)+'개';$('#progress').innerHTML=`<span style="width:${t.stickers?t.normal/t.stickers*100:0}%"></span><span style="width:${t.stickers?t.uncertain/t.stickers*100:0}%"></span>`;$('#legend').innerHTML=`<span>아마 가능 ${num(t.normal)}</span><span>되긴 하는데… ${num(t.uncertain)}</span>`;
  $('#rooms').innerHTML=data.rooms.length?`<table><thead><tr><th scope="col">모임</th><th scope="col">기간</th><th scope="col">참여 / 전체</th><th scope="col">투표 참여</th><th scope="col">현재 유력 일시</th></tr></thead><tbody>${data.rooms.map(r=>`<tr><td><strong>${esc(r.title)}</strong></td><td>${r.start}<br>~ ${r.end}</td><td>${r.participants} / ${r.expected||'미설정'}</td><td><span class="badge">${r.voters}명 · ${r.rate}%</span></td><td>${r.best?`${r.best.date} ${r.best.slot==='L'?'점심':'저녁'}<br>${r.best.count}/${r.target}명 가능`:'—'}</td></tr>`).join('')}</tbody></table>`:'<p class="empty">집계할 모임이 없어요. 기존 모임 JSON을 아래에서 불러와 주세요.</p>';
  const c=data.coverage;$('#coverage').hidden=!c.failed&&c.historicalImported;$('#coverage').textContent=[!c.historicalImported?'새 모임과 등록된 모임은 자동 갱신 중입니다. 통계 도입 이전의 모임은 아래 ‘최초 1회’ 등록이 필요해 전체 모임 수에 아직 포함되지 않을 수 있어요.':'',c.failed?`${c.indexed}개 중 ${c.failed}개를 불러오지 못해 일부 통계만 표시합니다. 새로고침해 주세요.`:''].filter(Boolean).join(' ');
  if(document.activeElement!==$('#gaId'))$('#gaId').value=data.ga.measurementId||'';
  $('#gaStatus').textContent=data.ga.configured?'연결됨 · '+data.ga.measurementId:'연결 대기 · 아래에 GA4 측정 ID를 입력하고 저장해 주세요.';
  $('#status').textContent=new Date(data.generatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' 기준 · 삭제된 모임 '+c.deleted+'개 제외';
 }
 async function load(force=false){if(loading)return;loading=true;const token=++request;$('#refresh').disabled=true;$('#status').textContent='현황을 불러오는 중…';try{const data=await api('/api/admin?days='+$('#days').value+(force?'&refresh=1':''));if(token!==request)return;render(data)}catch(e){if(token!==request)return;if([401,403].includes(e.status))gate(e);else $('#status').textContent=e.message}finally{loading=false;if(token===request)$('#refresh').disabled=false}}
 $('#gaForm').onsubmit=async e=>{
  e.preventDefault();const measurementId=$('#gaId').value.trim().toUpperCase();
  if(!/^G-[A-Z0-9]{5,20}$/.test(measurementId)){$('#gaMessage').textContent='G-로 시작하는 측정 ID를 입력해 주세요.';return}
  $('#saveGa').disabled=true;
  try{await api('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'ga',measurementId})});$('#gaMessage').textContent='저장했어요. 서비스 페이지를 새로 열면 수집을 시작합니다.';await load(true)}catch(e){$('#gaMessage').textContent=e.message}finally{$('#saveGa').disabled=false}
 };
 $('#refresh').onclick=()=>load(true);$('#days').onchange=()=>load();$('#import').onclick=()=>$('#importFile').click();
 $('#importFile').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;$('#import').disabled=true;$('#importStatus').textContent='모임 목록을 확인하는 중…';
  try{
   if(file.size>10*1024*1024)throw Error('파일은 10MB 이하로 선택해 주세요.');
   const raw=JSON.parse(await file.text()),sessions=raw.sessions||raw,ids=Object.keys(sessions).filter(id=>/^m_[a-f0-9]{64}$/.test(id)&&sessions[id]?.meta);if(!ids.length)throw Error('sessions 내보내기 JSON인지 확인해 주세요.');
   let imported=0,failed=0;for(let start=0;start<ids.length;start+=8){const result=await api('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'import',ids:ids.slice(start,start+8),complete:start+8>=ids.length&&failed===0})});imported+=result.imported;failed+=result.failed+result.missing;$('#importStatus').textContent=`${Math.min(start+8,ids.length)}/${ids.length}개 확인 중…`}
   $('#importStatus').textContent=imported+'개 모임을 등록했어요.'+(failed?' '+failed+'개는 불러오지 못했어요. 다시 파일을 선택해 주세요.':'');await load(true);
  }catch(e){$('#importStatus').textContent=e instanceof SyntaxError?'JSON 파일 형식을 확인해 주세요.':e.message}finally{$('#import').disabled=false;e.target.value=''}
 };
 api('/api/admin?mode=access').then(()=>{authorized=true;$('#gate').hidden=true;$('#dashboard').hidden=false;load()}).catch(gate);
 // Do not overlap long-running requests or poll while the page is hidden.
 setInterval(()=>{if(authorized&&!document.hidden)void load(true)},30000);
 document.addEventListener('visibilitychange',()=>{if(authorized&&!document.hidden)void load(true)});
 window.addEventListener('focus',()=>{if(authorized&&!document.hidden)void load(true)});
})();
