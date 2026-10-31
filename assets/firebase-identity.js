// Firebase auth is memory-only. No token/account identity is restored from browser storage.
(function(){
 let flight=null;
 async function ensure(userId){
  if(!/^kakao_[0-9]+$/.test(userId||''))throw Error('카카오 로그인이 필요해요.');
  if(!window.firebase?.auth)throw Error('로그인 모듈을 불러오지 못했어요. 새로고침해 주세요.');
  const auth=firebase.auth();
  await auth.setPersistence(firebase.auth.Auth.Persistence.NONE);
  if(auth.currentUser?.uid===userId)return;
  if(flight){await flight.promise;if(auth.currentUser?.uid===userId)return;}
  const task={userId};
  task.promise=(async()=>{
   await auth.setPersistence(firebase.auth.Auth.Persistence.NONE);
   const response=await fetch(new URL('/api/firebase-token',window.APP_CONFIG.authServer),{
    method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store',signal:AbortSignal.timeout(10000)
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'로그인 확인에 실패했어요.');
   if(data.uid!==userId||typeof data.token!=='string')throw Error('계정이 변경됐어요. 다시 로그인해 주세요.');
   await auth.signInWithCustomToken(data.token);
   if(auth.currentUser?.uid!==userId){await auth.signOut();throw Error('계정 확인에 실패했어요.');}
  })();
  flight=task;
  try{await task.promise;}finally{if(flight===task)flight=null;}
 }
 async function clear(){if(flight)try{await flight.promise;}catch{};if(window.firebase?.auth)await firebase.auth().signOut();}
 window.FirebaseIdentity={ensure,clear};
})();
