// Deployment migration: a fixed, bundled policy, never rules supplied by a request.
// A private backup is retained before changing the live policy. Service account only.
const desired=require('../database.rules.json');
const {db}=require('./firebase-admin-rest');
const version='workflow-v2';
let verifiedUntil=0;
async function ensure(){
 if(verifiedUntil>Date.now())return;
 if(await db('schema/'+version)===true){verifiedUntil=Date.now()+300000;return;}
 await require('./meeting-workflow').locked('policy',async()=>{
  if(await db('schema/'+version)===true){verifiedUntil=Date.now()+300000;return;}
  const old=await db('.settings/rules');
  if(!await db('policyBackups/'+version))await db('policyBackups/'+version,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({at:Date.now(),rules:JSON.stringify(old)})});
  await db('.settings/rules',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(desired)});
  await db('schema/'+version,{method:'PUT',headers:{'Content-Type':'application/json'},body:'true'});
  verifiedUntil=Date.now()+300000;
 });
}
module.exports={ensure};
