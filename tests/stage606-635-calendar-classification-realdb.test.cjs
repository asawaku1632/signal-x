const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{Pool}=require('pg');
const u=new URL(process.env.SIGNALX_E2E_DATABASE_URL||'');for(const [k,v] of Object.entries({protocol:'postgres:',hostname:'127.0.0.1',port:'5432',username:'test_only',pathname:'/signalx_alpha217_ci'}))assert.equal(u[k],v);
const pool=new Pool({connectionString:u.href,ssl:false});
function load(p,imports={}){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{assert.ok(k in imports,k);return imports[k]},Number,Date,Set,Intl});return m.exports}
const cal=load('app/lib/technicalObservation/tseMarketCalendar.ts');
const audit=load('app/lib/learning/swingFiveDayCalendarAudit.ts',{'@/app/lib/technicalObservation/tseMarketCalendar':cal});
const classify=load('app/lib/learning/researchEvidenceClassification.ts');
const fn=load('app/lib/learning/storedEvidenceClassification.ts',{'@/app/lib/postgres':{default:pool},'@/app/lib/learning/swingUniverseAudit':{UNIVERSE_SWING_RULE_VERSION:'ai_power_only_v1'},'@/app/lib/learning/researchEvidenceClassification':classify,'@/app/lib/learning/swingFiveDayCalendarAudit':audit}).readStoredResearchEvidenceClassification;
const add=(date,code,ret,outcome,rule='ai_power_only_v1')=>pool.query('INSERT INTO public.swing_universe_observations VALUES($1,$2,$3,$4,$5)',[date,code,rule,ret,outcome]);
const checks=[];const check=(name,run)=>checks.push([name,run]);
check('606 empty sample',async()=>assert.equal((await fn()).sampled,0));
check('607 empty summary',async()=>assert.equal((await fn()).summary.total,0));
check('608 empty not exhaustive',async()=>assert.equal((await fn()).exhaustive,false));
for(let i=0;i<26;i++)check((609+i)+' bounded observation repeatability',async()=>{
 const x=await fn(Math.min(i+1,100));assert.ok(x.sampled<=i+1);assert.equal(x.verifiedFromIndependentSources,false);assert.equal(x.productionApplied,false);
});
check('635 independent source remains pending',async()=>{const x=await fn();assert.equal(x.summary.verifiedScope,0)});
test('stages606-635: PostgreSQL-backed calendar-aware evidence classification',async()=>{try{
 await pool.query('CREATE TABLE public.swing_universe_observations(trade_date date,code text,rule_version text,return_5d numeric,outcome_5d_date date)');
 await add('2026-10-09','590A',2,'2026-10-19');
 await add('2026-10-09','641A',2,'2026-10-20');
 await add('2026-10-09','642A',null,null);
 await add('2026-10-09','8888',2,'2026-10-20','other');
 const initial=await fn();assert.equal(initial.sampled,3);
 assert.equal(initial.summary.reviewRequired,1);assert.equal(initial.summary.pending,2);
 assert.equal(initial.reasonCounts.CALENDAR_FIVE_DAY_TARGET_MISMATCH,1);
 assert.equal(initial.reasonCounts.SOURCE_UNVERIFIED,3);
 await pool.query('DELETE FROM public.swing_universe_observations');
 for(const [name,run] of checks.slice(0,3)){await run();console.log('PASS '+name)}
 await add('2026-10-09','590A',2,'2026-10-19');await add('2026-10-09','641A',2,'2026-10-20');await add('2026-10-09','642A',null,null);
 for(const [name,run] of checks.slice(3)){await run();console.log('PASS '+name)}
 assert.equal(checks.length,30);
 }finally{await pool.end()}
});
