// Deployment smoke checks. No user meeting/profile data is created or modified. Never log credentials.
import assert from 'node:assert/strict';
const origin=process.argv[2];
assert(origin && new URL(origin).protocol==='https:','Pass the deployed HTTPS origin.');
async function check(path,status,verify,options={}) {
 const response=await fetch(new URL(path,origin),{redirect:'manual',signal:AbortSignal.timeout(15000),...options});
 assert.equal(response.status,status,`${path}: unexpected status ${response.status}`);
 if(verify)await verify(response);
 console.log(`PASS ${status} ${path}`);
}
await check('/?s=m_migration_readonly',200,async r=>{assert.match(r.headers.get('content-type')||'',/text\/html/);assert((await r.text()).includes('firebase-identity.js'));assert.equal(r.headers.get('x-frame-options'),'DENY');});
await check('/config.js',200,async r=>{assert((await r.text()).includes('requireFirebaseAuth:true'));});
await check('/api/calendar-config',200,async r=>{const data=await r.json();assert.equal(data.enabled,true);assert.equal(data.configured,true);assert.match(data.clientId,/\.apps\.googleusercontent\.com$/);assert.match(r.headers.get('cache-control')||'',/no-store/);});
await check('/api/admin',401);
await check('/api/profile-status',200,async r=>{const d=await r.json();assert.equal(d.profilesReadable,false);assert.equal(d.reason,'PERMISSION_DENIED');});
await check('/api/meeting',401,null,{method:'POST',headers:{Origin:new URL(origin).origin,'Content-Type':'application/json'},body:JSON.stringify({sid:'m_'+'0'.repeat(64),action:'update',changes:{expectedCount:2}})});
await check('/api/not-a-real-endpoint',404);
await check('/privacy-policy',302,r=>assert.equal(r.headers.get('location'),'/privacy-policy/en'),{headers:{'Accept-Language':'en-US,en;q=0.9'}});
await check('/privacy-policy/en',200,r=>assert.match(r.headers.get('content-type')||'',/text\/html/));
await check('/privacy-policy/ko',200,null,{headers:{'Accept-Language':'en-US'}});
for(const path of ['/api/firebase-token.js','/lib/admin-auth.js','/database.secure.rules.json','/CLOUDFLARE-MIGRATION.md'])await check(path,404);
await check('/api/kakao',401,null,{headers:{Origin:'https://pickatime.xyz'}});
await check('/api/firebase-token',401,null,{method:'POST',headers:{Origin:'https://pickatime.xyz','Content-Type':'application/json'},body:'{}'});
await check('/api/firebase-token',204,null,{method:'OPTIONS',headers:{Origin:'https://pickatime.xyz','Access-Control-Request-Method':'POST'}});
console.log('PASS deployed page and access checks. Login, Firebase writes and deletion require separate authenticated checks.');
