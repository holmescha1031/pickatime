const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('async function meetingAction('),html.indexOf('async function finishMeetingSync('));
(async()=>{
 let calls=[],mode='busy';const c={sid:'original',store:{demo:false},window:{APP_CONFIG:{authServer:'https://example.test'}},URL,Math,JSON,Promise,Error,setTimeout:f=>f(),fetch:async(url,options)=>{calls.push(options);c.sid='navigated';return mode==='busy'&&calls.length===1?{status:409,ok:false,json:async()=>({retryable:true,error:'busy'})}:mode==='conflict'?{status:409,ok:false,json:async()=>({error:'already confirmed'})}:{status:200,ok:true,json:async()=>({saved:true})}}};vm.runInNewContext(source,c);
 assert.equal((await c.meetingAction('update',{changes:{expectedCount:4}})).saved,true);assert.equal(calls.length,2);assert(calls.every(x=>JSON.parse(x.body).sid==='original'));
 calls=[];mode='conflict';await assert.rejects(c.meetingAction('confirm'),/already confirmed/);assert.equal(calls.length,1);
 calls=[];mode='busy';c.fetch=async()=>{calls.push(1);return {status:409,ok:false,json:async()=>({retryable:true,error:'busy'})}};await assert.rejects(c.meetingAction('join'),/busy/);assert.equal(calls.length,8);
 console.log('PASS: only transient lease conflicts are retried, semantic conflicts stop, retries are bounded, and the original meeting is retained across navigation.');
})().catch(e=>{console.error(e);process.exitCode=1});
