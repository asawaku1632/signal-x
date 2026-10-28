const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{Pool}=require('pg');
const url=process.env.SIGNALX_E2E_DATABASE_URL||'',u=new URL(url);
for(const [k,v] of Object.entries({protocol:'postgres:',hostname:'127.0.0.1',port:'5432',username:'test_only',pathname:'/signalx_alpha217_ci',search:'',hash:''}))assert.equal(u[k],v);
const pool=new Pool({connectionString:url,ssl:false});
function load(path,imports){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{if(!(k in imports))throw Error(k);return imports[k]},Number,Date,Set,Intl,Math});return m.exports}
const cal=load('app/lib/technicalObservation/tseMarketCalendar.ts',{});
const audit=load('app/lib/learning/swingFiveDayCalendarAudit.ts',{'@/app/lib/technicalObservation/tseMarketCalendar':cal});
const inspect=load('app/lib/learning/swingCalendarPagedAudit.ts',{'@/app/lib/postgres':{default:pool},'@/app/lib/learning/swingFiveDayCalendarAudit':audit,'@/app/lib/learning/swingUniverseAudit':{UNIVERSE_SWING_RULE_VERSION:'ai_power_only_v1'}}).inspectAllSwingCalendarRows;
async function main(){try{
const id=(await pool.query('SELECT current_database() db,current_user role')).rows[0];assert.equal(id.db,'signalx_alpha217_ci');assert.equal(id.role,'test_only');
await pool.query('CREATE TABLE public.swing_universe_observations(trade_date date NOT NULL,code text NOT NULL,rule_version text NOT NULL,return_5d numeric,outcome_5d_date date)');
const add=async(code,day,ret,outcome,rule='ai_power_only_v1')=>pool.query('INSERT INTO public.swing_universe_observations VALUES($1,$2,$3,$4,$5)',[day,code,rule,ret,outcome]);
let r=await inspect(10,2);assert.equal(r.complete,true);assert.equal(r.inspected,0);
await add('1000','2026-10-09',2,'2026-10-19');await add('1001','2026-10-09',2,'2026-10-19');
await add('1002','2026-10-09',2,'2026-10-20');await add('1003','2026-10-09',2,null);
await add('1004','2026-10-09',null,'2026-10-19');
await add('1005','2026-10-09',2,'2026-10-12');
await add('1006','2025-10-09',2,'2025-10-16');
await add('9999','2026-10-09',2,'2026-10-20','other');
r=await inspect(20,2);assert.equal(r.eligible,7);assert.equal(r.inspected,7);assert.equal(r.complete,true);
assert.equal(r.issueCount,5);assert.equal(r.issues.some(x=>x.reason==='FIVE_DAY_TARGET_MISMATCH'),true);
assert.equal(r.issues.some(x=>x.reason==='MARKET_CALENDAR_UNAVAILABLE'),true);
r=await inspect(3,2);assert.equal(r.inspected,3);assert.equal(r.uninspected,4);assert.equal(r.complete,false);
await assert.rejects(inspect(0),/INVALID_AUDIT_BUDGET/);
await assert.rejects(inspect(20,501),/INVALID_AUDIT_BUDGET/);
assert.equal(r.approvalGranted,false);assert.equal(r.productionApplied,false);assert.equal(r.notificationEnabled,false);
console.log('PASS 286-295 paged repeatable-read isolated PG: empty, multi-page, anomalies, bounds, scope and no activation');
}finally{await pool.end()}}
main().catch(e=>{console.error(e);process.exitCode=1});
