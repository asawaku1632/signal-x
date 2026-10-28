const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{Pool}=require('pg');
const raw=process.env.SIGNALX_E2E_DATABASE_URL||'',u=new URL(raw);
for(const [k,v] of Object.entries({protocol:'postgres:',hostname:'127.0.0.1',port:'5432',username:'test_only',pathname:'/signalx_alpha217_ci',search:'',hash:''}))assert.equal(u[k],v);
const pool=new Pool({connectionString:raw,ssl:false,max:5});
function load(p,imports={}){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{if(!(k in imports))throw Error(k);return imports[k]},Number,Date,Set,Intl});return m.exports}
const cal=load('app/lib/technicalObservation/tseMarketCalendar.ts');
const audit=load('app/lib/learning/swingFiveDayCalendarAudit.ts',{'@/app/lib/technicalObservation/tseMarketCalendar':cal});
const guard=load('app/lib/learning/swingAuditResumeGuard.ts');
const scan=load('app/lib/learning/swingIntegratedResumeScan.ts',{'@/app/lib/postgres':{default:pool},'@/app/lib/learning/swingFiveDayCalendarAudit':audit,'@/app/lib/learning/swingAuditResumeGuard':guard,'@/app/lib/learning/swingUniverseAudit':{UNIVERSE_SWING_RULE_VERSION:'ai_power_only_v1'}}).inspectResumeAndScan;
const fingerprint=async()=>{const r=await pool.query(`SELECT COUNT(*) FILTER(WHERE return_5d IS NOT NULL OR outcome_5d_date IS NOT NULL)::integer eligible,
md5(COALESCE(string_agg(trade_date::text||':'||code||':'||COALESCE(return_5d::text,'NULL')||':'||COALESCE(outcome_5d_date::text,'NULL'),'|' ORDER BY trade_date,code),'EMPTY')) digest FROM public.swing_universe_observations WHERE rule_version=$1`,['ai_power_only_v1']);return r.rows[0]};
const checkpoint=async()=>{const a=await fingerprint();return {auditId:'audit1',ruleVersion:'ai_power_only_v1',fingerprint:a.digest,eligible:a.eligible,inspected:0,cursorDate:null,cursorCode:null,completed:false}};
const steps=[];
const verify=(name,fn)=>steps.push([name,fn]);
verify('366 initial complete scan',async(cp)=>assert.equal((await scan(cp,2,5)).scanned,3));
verify('367 final completion',async(cp)=>assert.equal((await scan(cp,2,5)).completed,true));
verify('368 partial one-page scan',async(cp)=>assert.equal((await scan(cp,1,1)).scanned,1));
verify('369 partial remaining',async(cp)=>assert.equal((await scan(cp,1,1)).remaining,2));
verify('370 partial non-completion',async(cp)=>assert.equal((await scan(cp,1,1)).completed,false));
verify('371 continuation from checkpoint',async(cp)=>{const a=await scan(cp,1,1);const b=await scan({...cp,inspected:1,cursorDate:a.cursorDate,cursorCode:a.cursorCode},2,2);assert.equal(b.scanned,2)});
verify('372 resumed completion',async(cp)=>{const a=await scan(cp,1,1);const b=await scan({...cp,inspected:1,cursorDate:a.cursorDate,cursorCode:a.cursorCode},2,2);assert.equal(b.completed,true)});
verify('373 no repeat of first page',async(cp)=>{const a=await scan(cp,1,1);const b=await scan({...cp,inspected:1,cursorDate:a.cursorDate,cursorCode:a.cursorCode},2,2);assert.notEqual(b.cursorCode,a.cursorCode)});
verify('374 mismatched outcome identified',async(cp)=>assert.ok((await scan(cp,3,2)).issues.some(x=>x.reason==='FIVE_DAY_TARGET_MISMATCH')));
verify('375 one invalid outcome counted once',async(cp)=>assert.equal((await scan(cp,1,5)).issues.filter(x=>x.code==='641A').length,1));
verify('376 stopped if fingerprint changes',async(cp)=>assert.equal((await scan({...cp,fingerprint:'b'.repeat(32)})).action,'STOP'));
verify('377 changed return stops',async(cp)=>{await pool.query("UPDATE public.swing_universe_observations SET return_5d=8 WHERE code='590A'");assert.equal((await scan(cp)).action,'STOP');await pool.query("UPDATE public.swing_universe_observations SET return_5d=2 WHERE code='590A'")});
verify('378 changed date stops',async(cp)=>{await pool.query("UPDATE public.swing_universe_observations SET outcome_5d_date='2026-10-20' WHERE code='590A'");assert.equal((await scan(cp)).action,'STOP');await pool.query("UPDATE public.swing_universe_observations SET outcome_5d_date='2026-10-19' WHERE code='590A'")});
verify('379 added observation stops',async(cp)=>{await pool.query("INSERT INTO public.swing_universe_observations VALUES('2026-10-09','9998','ai_power_only_v1',2,'2026-10-19')");assert.equal((await scan(cp)).action,'STOP');await pool.query("DELETE FROM public.swing_universe_observations WHERE code='9998'")});
verify('380 deleted observation stops',async(cp)=>{await pool.query("DELETE FROM public.swing_universe_observations WHERE code='642A'");assert.equal((await scan(cp)).action,'STOP');await pool.query("INSERT INTO public.swing_universe_observations VALUES('2026-10-08','642A','ai_power_only_v1',3,'2026-10-16')")});
verify('381 unrelated rule ignored',async(cp)=>{await pool.query("INSERT INTO public.swing_universe_observations VALUES('2026-10-09','9999','other',2,'2026-10-20')");assert.equal((await scan(cp)).action,'RESUME')});
verify('382 bad rule stops',async(cp)=>assert.equal((await scan({...cp,ruleVersion:'wrong'})).action,'STOP'));
verify('383 invalid ID stops',async(cp)=>assert.equal((await scan({...cp,auditId:'../oops'})).action,'STOP'));
verify('384 invalid cursor stops',async(cp)=>assert.equal((await scan({...cp,inspected:1,cursorDate:'wrong',cursorCode:'590A'})).action,'STOP'));
verify('385 lost cursor stops',async(cp)=>assert.equal((await scan({...cp,inspected:1})).action,'STOP'));
verify('386 completed job stops',async(cp)=>assert.equal((await scan({...cp,completed:true})).action,'STOP'));
verify('387 overrun count stops',async(cp)=>assert.equal((await scan({...cp,inspected:5})).action,'STOP'));
verify('388 zero page size rejected',async(cp)=>await assert.rejects(scan(cp,0,1),/INVALID_BOUNDS/));
verify('389 oversize page rejected',async(cp)=>await assert.rejects(scan(cp,201,1),/INVALID_BOUNDS/));
verify('390 zero pages rejected',async(cp)=>await assert.rejects(scan(cp,1,0),/INVALID_BOUNDS/));
verify('391 too many pages rejected',async(cp)=>await assert.rejects(scan(cp,1,51),/INVALID_BOUNDS/));
verify('392 scoped non-approval',async(cp)=>assert.equal((await scan(cp,2,2)).adoptionApproved,false));
verify('393 notifications disabled',async(cp)=>assert.equal((await scan(cp,2,2)).notificationEnabled,false));
verify('394 production untouched',async(cp)=>assert.equal((await scan(cp,2,2)).productionApplied,false));
verify('395 SQL read-only transaction',async()=>assert.match(fs.readFileSync('app/lib/learning/swingIntegratedResumeScan.ts','utf8'),/REPEATABLE READ READ ONLY/));
test('stages366-395: 30 actual PostgreSQL integrations',async()=>{
 try{await pool.query('CREATE TABLE public.swing_universe_observations(trade_date date,code text,rule_version text,return_5d numeric,outcome_5d_date date,UNIQUE(trade_date,code))');
 await pool.query("INSERT INTO public.swing_universe_observations VALUES ('2026-10-09','590A','ai_power_only_v1',2,'2026-10-19'),('2026-10-09','641A','ai_power_only_v1',2,'2026-10-20'),('2026-10-08','642A','ai_power_only_v1',3,'2026-10-16')");
 const cp=await checkpoint();assert.equal(cp.eligible,3);
 for(const [name,fn] of steps){try{await fn(cp);console.log('PASS '+name)}catch(e){console.error('FAIL '+name);throw e}}
 assert.equal(steps.length,30);
 }finally{await pool.end()}
});
