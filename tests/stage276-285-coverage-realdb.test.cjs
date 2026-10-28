const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{Pool}=require('pg');
const url=process.env.SIGNALX_E2E_DATABASE_URL||'',u=new URL(url);
for(const [k,v] of Object.entries({protocol:'postgres:',hostname:'127.0.0.1',port:'5432',username:'test_only',pathname:'/signalx_alpha217_ci',search:'',hash:''}))assert.equal(u[k],v);
const pool=new Pool({connectionString:url,ssl:false});
function load(path,imports){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{if(!(k in imports))throw Error(k);return imports[k]},Number,Date,Set,Intl,Math});return m.exports}
const cal=load('app/lib/technicalObservation/tseMarketCalendar.ts',{});
const audit=load('app/lib/learning/swingFiveDayCalendarAudit.ts',{'@/app/lib/technicalObservation/tseMarketCalendar':cal});
const read=load('app/lib/learning/swingCalendarDbSample.ts',{'@/app/lib/postgres':{default:pool},'@/app/lib/learning/swingFiveDayCalendarAudit':audit,'@/app/lib/learning/swingUniverseAudit':{UNIVERSE_SWING_RULE_VERSION:'ai_power_only_v1'}}).readSwingFiveDayCalendarSample;
async function run(){try{
 const id=(await pool.query('SELECT current_database() db,current_user role')).rows[0];assert.equal(id.db,'signalx_alpha217_ci');assert.equal(id.role,'test_only');
 await pool.query('CREATE TABLE public.swing_universe_observations(trade_date date,code text,rule_version text,return_5d numeric,outcome_5d_date date)');
 const put=(code,date,ret,outcome,rule='ai_power_only_v1')=>pool.query('INSERT INTO public.swing_universe_observations VALUES($1,$2,$3,$4,$5)',[date,code,rule,ret,outcome]);
 // 276 empty
 let r=await read();assert.equal(r.totalObservations,0);assert.equal(r.coveragePercent,0);
 // 277 non-evaluated rows, 278 valid row, 279 incomplete sample count
 await put('a','2026-10-09',null,null);
 await put('b','2026-10-09',2,'2026-10-19');
 await put('c','2026-10-09',3,'2026-10-19');
 r=await read(1);assert.equal(r.totalObservations,3);assert.equal(r.eligibleObservations,2);assert.equal(r.notYetEvaluated,1);
 assert.equal(r.inspected,1);assert.equal(r.uninspectedEligible,1);assert.equal(r.coveragePercent,50);assert.equal(r.limitReached,true);
 // 280 all eligible examined
 r=await read(10);assert.equal(r.uninspectedEligible,0);assert.equal(r.limitReached,false);assert.equal(r.coveragePercent,100);
 // 281 calendar unavailable on an older date in eligible sample
 await put('d','2025-10-09',1,'2025-10-16');r=await read(10);assert.equal(r.calendarUnavailableInSample,1);assert.equal(r.exhaustive,false);
 // 282 other rule cannot change counts
 await put('e','2026-10-09',1,'2026-10-20','different');assert.equal((await read(10)).totalObservations,4);
 // 283 limit validation
 await assert.rejects(read(0),/INVALID_CALENDAR_SAMPLE_LIMIT/);await assert.rejects(read(101),/INVALID_CALENDAR_SAMPLE_LIMIT/);
 // 284 SQL is read-only, 285 owner authorization precedes database read
 const src=fs.readFileSync('app/lib/learning/swingCalendarDbSample.ts','utf8');
 assert.doesNotMatch(src,/INSERT INTO|UPDATE public|DELETE FROM/);
 const route=fs.readFileSync('app/api/admin/integrated-research-review/route.ts','utf8');
 assert.ok(route.indexOf('if(!owner.isOwner)')<route.indexOf('getIntegratedResearchReview()'));
 console.log('PASS stages276-285: real PostgreSQL coverage, uninspected, calendar unavailable, rule isolation, read only');
}finally{await pool.end()}}
run().catch(e=>{console.error(e);process.exitCode=1});
