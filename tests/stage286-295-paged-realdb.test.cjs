const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),{Pool}=require('pg');
const raw=process.env.SIGNALX_E2E_DATABASE_URL||'',url=new URL(raw);
for(const [k,v] of Object.entries({protocol:'postgres:',hostname:'127.0.0.1',port:'5432',username:'test_only',pathname:'/signalx_alpha217_ci',search:'',hash:''}))assert.equal(url[k],v);
const pool=new Pool({connectionString:raw,ssl:false});
function load(path,imports){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{assert.ok(k in imports);return imports[k]},Date,Number,Set,Intl});return m.exports}
const cal=load('app/lib/technicalObservation/tseMarketCalendar.ts',{});
const audit=load('app/lib/learning/swingFiveDayCalendarAudit.ts',{'@/app/lib/technicalObservation/tseMarketCalendar':cal});
const fn=load('app/lib/learning/swingCalendarPagedAudit.ts',{'@/app/lib/postgres':{default:pool},'@/app/lib/learning/swingFiveDayCalendarAudit':audit,'@/app/lib/learning/swingUniverseAudit':{UNIVERSE_SWING_RULE_VERSION:'ai_power_only_v1'}}).auditSwingFiveDayCalendarPages;
async function main(){try{
 const id=(await pool.query('SELECT current_database() db,current_user role')).rows[0];assert.equal(id.db,'signalx_alpha217_ci');assert.equal(id.role,'test_only');
 await pool.query('CREATE TABLE public.swing_universe_observations(trade_date date,code text,rule_version text,return_5d numeric,outcome_5d_date date,UNIQUE(trade_date,code))');
 let r=await fn(2,2);assert.equal(r.inspected,0);assert.equal(r.scanExhausted,true);
 for(let i=0;i<7;i++)await pool.query('INSERT INTO public.swing_universe_observations VALUES($1,$2,$3,$4,$5)',[i<4?'2026-10-09':'2026-10-08',String(1000+i),'ai_power_only_v1',i===3?null:2,i===4?'2026-10-20':'2026-10-19']);
 r=await fn(2,2);assert.equal(r.inspected,4);assert.equal(r.uninspected,3);assert.equal(r.scanExhausted,false);
 r=await fn(2,5);assert.equal(r.inspected,7);assert.equal(r.uninspected,0);assert.equal(r.scanExhausted,true);
 assert.ok(r.issues.some(x=>x.reason==='DATE_MISSING_RETURN'));assert.ok(r.issues.some(x=>x.reason==='FIVE_DAY_TARGET_MISMATCH'));
 assert.equal(r.issues.filter(x=>x.code==='1004').length,1);
 await pool.query("INSERT INTO public.swing_universe_observations VALUES('2026-10-09','other','other_v1',2,'2026-10-20')");
 assert.equal((await fn(3,3)).eligible,7);
 await assert.rejects(fn(0,1),/INVALID_AUDIT_BOUNDS/);await assert.rejects(fn(201,1),/INVALID_AUDIT_BOUNDS/);await assert.rejects(fn(2,51),/INVALID_AUDIT_BOUNDS/);
 assert.equal(r.independentlyVerified,false);assert.equal(r.productionApplied,false);assert.equal(r.notificationEnabled,false);
 console.log('PASS stages286-295: pagination, repeatable-read snapshot, boundaries, unique cursor, actual SQL and fail-closed flags');
 }finally{await pool.end()}}
main().catch(e=>{console.error(e);process.exitCode=1});
