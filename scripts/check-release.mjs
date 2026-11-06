import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for(const test of readdirSync('tests').filter(file=>/\.(?:cjs|mjs)$/.test(file)).sort()){
 const result=spawnSync(process.execPath,['tests/'+test],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
console.log('Release regression checks passed.');
