const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{Pool}=require('pg');
const raw=process.env.SIGNALX_E2E_DATABASE_URL||'',u=new URL(raw);
for(const [k,v] of Object.entries({protocol:'postgres:',hostname:'127.0.0.1',port:'5432',username:'test_only',pathname:'/signalx_alpha217_ci',search:'',hash:''}))assert.equal(u[k],v);
const pool=new Pool({connectionString:raw,ssl:false});
function load(path,imports={}){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{if(!(k in imports))throw Error(k);return imports[k]},Number,Date,Set,Intl});return m.exports}
const cal=load('app/lib/technicalObservation/tseMarketCalendar.ts');
const audit=load('app/lib/learning/swingFiveDayCalendarAudit.ts',{'@/app/lib/technicalObservation/tseMarketCalendar':cal});
const guard=load('app/lib/learning/swingAuditResumeGuard.ts');
const sources={'@/app/lib/learning/swingFiveDayCalendarAudit':audit,'@/app/lib/learning/swingAuditResumeGuard':guard,'@/app/lib/learning/swingUniverseAudit':{UNIVERSE_SWING_RULE_VERSION:'ai_power_only_v1'}};
const make=(db)=>load('app/lib/learning/swingIntegratedResumeScan.ts',{...sources,'@/app/lib/postgres':{default:db}}).inspectResumeAndScan;
const scan=make(pool);
const aggregate=async()=> (await pool.query(`SELECT COUNT(*) FILTER(WHERE return_5d IS NOT NULL OR outcome_5d_date IS NOT NULL)::integer eligible,
 md5(COALESCE(string_agg(trade_date::text||':'||code||':'||COALESCE(return_5d::text,'NULL')||':'||COALESCE(outcome_5d_date::text,'NULL'),'|' ORDER BY trade_date,code),'EMPTY')) digest
 FROM public.swing_universe_observations WHERE rule_version='ai_power_only_v1'`)).rows[0];
const checkpoint=async()=>{const a=await aggregate();return {auditId:'audit1',ruleVersion:'ai_power_only_v1',fingerprint:a.digest,eligible:a.eligible,inspected:0,cursorDate:null,cursorCode:null,completed:false}};
const checks=[];const check=(name,fn)=>checks.push([name,fn]);
const source=fs.readFileSync('app/lib/learning/swingIntegratedResumeScan.ts','utf8');
check('396 begin READ ONLY',async()=>assert.match(source,/BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/));
check('397 safe COMMIT',async()=>assert.match(source,/await client.query\("COMMIT"\)/));
check('398 ROLLBACK on failure',async()=>assert.match(source,/await client.query\("ROLLBACK"\)/));
check('399 release in finally',async()=>assert.match(source,/finally\{client.release\(\)\}/));
check('400 no data mutation SQL',async()=>assert.doesNotMatch(source,/INSERT INTO|UPDATE public|DELETE FROM/));
check('401 real read only transaction',async()=>{const c=await pool.connect();try{await c.query('BEGIN TRANSACTION READ ONLY');await assert.rejects(c.query("INSERT INTO public.swing_universe_observations VALUES('2026-10-09','9999','ai_power_only_v1',2,'2026-10-19')"),/read-only transaction/i);await c.query('ROLLBACK')}finally{c.release()}});
check('402 untouched data count',async()=>assert.equal((await aggregate()).eligible,3));
check('403 good complete scan',async()=>assert.equal((await scan(await checkpoint(),1,5)).completed,true));
check('404 good scan count',async()=>assert.equal((await scan(await checkpoint(),2,5)).scanned,3));
check('405 first page count',async()=>assert.equal((await scan(await checkpoint(),1,1)).scanned,1));
check('406 second page cursor',async()=>{const a=await scan(await checkpoint(),1,1);assert.ok(a.cursorCode)});
check('407 invalid page size',async()=>await assert.rejects(scan(await checkpoint(),-1,1),/INVALID_BOUNDS/));
check('408 invalid page count',async()=>await assert.rejects(scan(await checkpoint(),1,-1),/INVALID_BOUNDS/));
check('409 fractional page size',async()=>await assert.rejects(scan(await checkpoint(),1.5,1),/INVALID_BOUNDS/));
check('410 fractional page count',async()=>await assert.rejects(scan(await checkpoint(),1,1.5),/INVALID_BOUNDS/));
check('411 excessive page count',async()=>await assert.rejects(scan(await checkpoint(),1,51),/INVALID_BOUNDS/));
check('412 oversized page',async()=>await assert.rejects(scan(await checkpoint(),201,1),/INVALID_BOUNDS/));
check('413 missing fingerprint stops',async()=>assert.equal((await scan({...await checkpoint(),fingerprint:''})).action,'STOP'));
check('414 wrong rule stops',async()=>assert.equal((await scan({...await checkpoint(),ruleVersion:'other'})).action,'STOP'));
check('415 completed guard stops',async()=>assert.equal((await scan({...await checkpoint(),completed:true})).action,'STOP'));
check('416 tampered eligible stops',async()=>assert.equal((await scan({...await checkpoint(),eligible:2})).action,'STOP'));
check('417 negative inspected stops',async()=>assert.equal((await scan({...await checkpoint(),inspected:-1})).action,'STOP'));
check('418 guard failure scans no rows',async()=>assert.equal((await scan({...await checkpoint(),fingerprint:'b'.repeat(32)})).scanned,0));
check('419 guard stop never approves',async()=>assert.equal((await scan({...await checkpoint(),fingerprint:'b'.repeat(32)})).productionApplied,false));
check('420 data unchanged after scan',async()=>assert.equal((await aggregate()).eligible,3));
const fault=(pattern)=>{const calls=[];let released=false;const db={connect:async()=>({query:async(sql,args)=>{calls.push(sql);if(pattern(sql))throw Error('INJECTED_DB_FAILURE');if(sql.startsWith('BEGIN')||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};if(sql.includes('COUNT(*) FILTER'))return {rows:[{eligible:3,digest:'a'.repeat(32)}]};return {rows:[]}},release(){released=true}})};return {scan:make(db),calls,released:()=>released}};
const cp={auditId:'audit1',ruleVersion:'ai_power_only_v1',fingerprint:'a'.repeat(32),eligible:3,inspected:0,cursorDate:null,cursorCode:null,completed:false};
for(const [num,pattern] of [[421,s=>s.startsWith('BEGIN')],[422,s=>s.includes('COUNT(*) FILTER')],[423,s=>s.includes('SELECT trade_date::text')]]){
 check(String(num)+' injected database fault triggers rollback',async()=>{const x=fault(pattern);await assert.rejects(x.scan(cp,1,1),/INJECTED_DB_FAILURE/);assert.ok(x.calls.some(s=>s==='ROLLBACK'));assert.equal(x.released(),true)});
}
check('424 invalid raw connection target cannot bypass allowlist',async()=>assert.equal(u.pathname,'/signalx_alpha217_ci'));
check('425 no production activation',async()=>{const r=await scan(await checkpoint(),2,2);assert.equal(r.productionApplied,false);assert.equal(r.notificationEnabled,false);assert.equal(r.adoptionApproved,false)});
test('stages396-425: 30 integration and failure checks',async()=>{try{await pool.query('CREATE TABLE public.swing_universe_observations(trade_date date,code text,rule_version text,return_5d numeric,outcome_5d_date date,UNIQUE(trade_date,code))');await pool.query("INSERT INTO public.swing_universe_observations VALUES('2026-10-09','590A','ai_power_only_v1',2,'2026-10-19'),('2026-10-09','641A','ai_power_only_v1',2,'2026-10-20'),('2026-10-08','642A','ai_power_only_v1',3,'2026-10-16')");assert.equal(checks.length,30);for(const [name,fn] of checks){try{await fn();console.log('PASS '+name)}catch(e){console.error('FAIL '+name);throw e}}}finally{await pool.end()}});
