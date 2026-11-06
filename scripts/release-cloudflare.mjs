// Stage and verify an immutable version before changing production traffic.
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
function cli(args){
 const result=spawnSync('npx',['--no-install','wrangler',...args],{encoding:'utf8',maxBuffer:8*1024*1024});
 if(result.status!==0)throw Error('Wrangler command failed: '+args.slice(0,2).join(' '));
 return result.stdout;
}
function current(run){
 const state=JSON.parse(run(['deployments','status','--json']));
 const versions=state.versions||state.deployment?.versions;
 if(!Array.isArray(versions)||versions.length!==1||versions[0].percentage!==100)throw Error('Expected one stable production version; refusing to replace a traffic split.');
 const id=versions[0].version_id||versions[0].id;
 if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Cannot determine the rollback version.');
 return id;
}
export async function release({run=cli,verify,alias='release-'+randomBytes(6).toString('hex')}={}){
 const previous=current(run);
 const output=run(['versions','upload','--preview-alias',alias]);console.log(output);
 const version=output.match(/(?:Worker )?Version ID:\s*([a-f0-9-]{36})/i)?.[1];
 const preview=(output.match(/https:\/\/[^\s)]+\.workers\.dev/g)||[]).find(url=>new URL(url).hostname.startsWith(alias+'-'));
 if(!version||!preview)throw Error('Upload returned no verified version URL; production has not been changed.');
 await verify(preview,true);
 if(current(run)!==previous)throw Error('Production changed during testing; refusing to overwrite a concurrent release.');
 run(['versions','deploy',version+'@100%','--yes']);
 try{
  await verify('https://pickatime.xyz',false);
 }catch(error){
  if(current(run)===version){run(['versions','deploy',previous+'@100%','--yes']);console.error('Restored previous code version. Database data and rules were not changed.');}
  throw error;
 }
 console.log('Staged checks and production checks passed.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const tests=spawnSync(process.execPath,['scripts/check-release.mjs'],{stdio:'inherit'});if(tests.status!==0)process.exit(tests.status||1);
 await release({verify:async(origin,preview)=>{const result=spawnSync(process.execPath,['scripts/verify-cloudflare.mjs',origin,...(preview?['--preview']:[])],{stdio:'inherit'});if(result.status!==0)throw Error('Release verification failed.');}});
}
