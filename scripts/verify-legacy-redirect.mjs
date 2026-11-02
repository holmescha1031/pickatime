// Read-only migration probes; never load an actual participant poll or a login callback.
import assert from 'node:assert/strict';
const legacy='https://pickatime-phi.vercel.app';
const current='https://pickatime.xyz';
for(const path of ['/?s=m_migration_readonly&tab=rank&sample=one%20two','/privacy-policy/en?source=legacy','/admin?tab=meetings']){
 const before=new URL(path,legacy);
 const response=await fetch(before,{redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,308,`${before.pathname}: expected permanent redirect, got ${response.status}`);
 const after=new URL(response.headers.get('location'),legacy);
 assert.equal(after.origin,current);
 assert.equal(after.pathname,before.pathname);
 assert.deepEqual([...after.searchParams],[...before.searchParams]);
 console.log(`PASS legacy 308 ${before.pathname}: path and query parameters preserved`);
 const destination=await fetch(after,{signal:AbortSignal.timeout(15000)});
 assert.equal(destination.status,200,`${after.pathname}: destination unavailable`);
 await destination.body?.cancel();
}
console.log('PASS legacy links resolve on pickatime.xyz.');
