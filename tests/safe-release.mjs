import assert from 'node:assert/strict';
import {release} from '../scripts/release-cloudflare.mjs';
const old='11111111-1111-1111-1111-111111111111',next='22222222-2222-2222-2222-222222222222';
async function scenario(failAt){let active=old;const changes=[],checked=[];const run=args=>{
 if(args[0]==='deployments')return JSON.stringify({versions:[{version_id:active,percentage:100}]});
 if(args[1]==='upload')return `Worker Version ID: ${next}\nVersion Preview URL: https://release-test-pickatime.example.workers.dev`;
 if(args[1]==='deploy'){active=args[2].split('@')[0];changes.push(active);return '';}
 assert.fail(args.join(' '));
 };const task=release({alias:'release-test',run,verify:async(url,preview)=>{checked.push(preview);if(failAt===(preview?'preview':'production'))throw Error('failed check')}});
 if(failAt)await assert.rejects(task);else await task;
 return {active,changes,checked};}
let r=await scenario('preview');assert.equal(r.active,old);assert.deepEqual(r.changes,[]);
r=await scenario('production');assert.equal(r.active,old);assert.deepEqual(r.changes,[next,old]);
r=await scenario();assert.equal(r.active,next);assert.deepEqual(r.checked,[true,false]);
console.log('PASS: failed staged checks never activate code; failed production checks restore the captured previous version; promotion follows preview success.');
