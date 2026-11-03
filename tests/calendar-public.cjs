const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const clientId='355689780866-testing.apps.googleusercontent.com';
const {encode}=require('../lib/calendar-settings');
const src=fs.readFileSync('api/calendar-config.js','utf8');
let saved=encode(clientId),fail=false;
const ctx={module:{exports:{}},process:{env:{}},require:p=>p.includes('admin-auth')?{authorize:(req,res)=>{res.status(401).json({error:'auth'});return false},siteOrigin:()=> 'https://test.example'}:p.includes('admin-index')?{privateKey:()=> 'private',db:async()=>{if(fail)throw Error();return saved}}:require('../lib/calendar-settings')};vm.runInNewContext(src,ctx);
async function call(method='GET',query={}){const res={setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this}};await ctx.module.exports({method,query,headers:{}},res);return res}
(async()=>{
 let r=await call();assert.equal(r.code,200);assert.equal(r.body.enabled,true);assert.equal(r.body.clientId,clientId);assert.deepEqual(Object.keys(r.body).sort(),['clientId','configured','enabled']);
 assert.equal((await call('GET',{mode:'admin'})).code,401);assert.equal((await call('POST')).code,401);
 saved={};assert.equal((await call()).body.enabled,false);fail=true;assert.equal((await call()).code,503);
 ctx.process.env.GOOGLE_CLIENT_ID=clientId;assert.equal((await call()).body.enabled,true);
 const html=fs.readFileSync('index.html','utf8');for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 assert(!html.includes('calendarFileInput'));assert(!html.includes('calendarHelpPane'));assert(!html.includes('GOOGLE_CALENDAR_PAUSED'));assert(!html.includes('calendarDemoRequested'));
 console.log('PASS public client configuration, protected admin writes, missing settings/retry fallback, page syntax and removed ICS controls.');
})().catch(e=>{console.error(e);process.exitCode=1});
