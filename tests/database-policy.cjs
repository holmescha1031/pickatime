const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const desired=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../database.rules.json')));
const calls=[],state={'.settings/rules':{rules:{'.read':false}}};let fail=false;
const fake={db:async(path,options={})=>{calls.push({path,options});if(options.method==='PUT'){if(path==='.settings/rules'&&fail)throw Error('rules compilation failed');const value=JSON.parse(options.body);if(path!=='.settings/rules'){const validate=v=>{if(v&&typeof v==='object')for(const [key,child]of Object.entries(v)){assert(!/[.#$\[\]\/]/.test(key),'Firebase keys cannot contain rule operators');validate(child)}};validate(value);}state[path]=value;}return state[path]??null}};
const source=fs.readFileSync(require('node:path').join(__dirname,'../lib/database-policy.js'),'utf8');
function fresh(){const context={require:p=>p.endsWith('database.rules.json')?desired:p==='./firebase-admin-rest'?fake:{locked:async(id,fn)=>fn()},module:{exports:{}},Date};vm.runInNewContext(source,context);return context.module.exports;}
(async()=>{
 const old=JSON.parse(JSON.stringify(state['.settings/rules']));fail=true;await assert.rejects(fresh().ensure(),/compilation/);assert.deepEqual(JSON.parse(state['policyBackups/workflow-v2'].rules),old);assert(!state['schema/workflow-v2']);assert.deepEqual(state['.settings/rules'],old);
 fail=false;await fresh().ensure();assert.deepEqual(state['.settings/rules'],desired);assert.equal(state['schema/workflow-v2'],true);assert.deepEqual(JSON.parse(state['policyBackups/workflow-v2'].rules),old);
 const writes=calls.filter(x=>x.options.method==='PUT').length;await fresh().ensure();assert.equal(calls.filter(x=>x.options.method==='PUT').length,writes);
 const r=desired.rules,s=r.sessions.$sid;assert.equal(r['.write'],false);assert.equal(s.meta['.write'],false);assert.equal(s.blocked['.write'],false);assert(!r.workflowJobs);assert(!r.reservations);
 const expr=r.profiles.$profileKey['.write'],check=(auth,key)=>vm.runInNewContext(expr,{auth,$profileKey:key});assert.equal(check(null,'u_fake'),false);assert.equal(check({uid:'kakao_1',token:{profileKey:'u_mine'}},'u_other'),false);assert.equal(check({uid:'kakao_1',token:{profileKey:'u_mine'}},'u_mine'),true);
 const dateExpr=s.votes.$mid.$date['.validate'];const datePattern=dateExpr.match(/matches\((\/.*?\/)\)/)[1];const regex=vm.runInNewContext(datePattern);assert(regex.test('2028-02-29'));for(const d of ['2027-02-29','2027-02-31','2027-04-31','2027-13-01','bad'])assert(!regex.test(d));
 console.log('PASS: fixed policy backup, rejected compilation leaves old rules and marker intact, retry/idempotency, server-only metadata and automatic X, private jobs/bookings, account-bound profile rules, valid calendar-date shapes.');
})().catch(e=>{console.error(e);process.exitCode=1});
