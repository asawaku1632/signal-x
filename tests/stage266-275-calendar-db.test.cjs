const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),{Pool}=require('pg');
const raw=process.env.SIGNALX_E2E_DATABASE_URL||'',u=new URL(raw);
for(const [k,v] of Object.entries({protocol:'postgres:',hostname:'127.0.0.1',port:'5432',username:'test_only',pathname:'/signalx_alpha217_ci',search:'',hash:''}))assert.equal(u[k],v);
const pool=new Pool({connectionString:raw,ssl:false});
function load(path,imports){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>{if(!(k in imports))throw Error(k);return imports[k]},Number,Date,Set,Intl});return m.exports;}
const calendar=load('app/lib/technicalObservation/tseMarketCalendar.ts',{});
const audit=load('app/lib/learning/swingFiveDayCalendarAudit.ts',{'@/app/lib/technicalObservation/tseMarketCalendar':calendar});
const read=load('app/lib/learning/swingCalendarDbSample.ts',{'@/app/lib/postgres':{default:pool},'@/app/lib/learning/swingFiveDayCalendarAudit':audit,'@/app/lib/learning/swingUniverseAudit':{UNIVERSE_SWING_RULE_VERSION:'ai_power_only_v1'}}).readSwingFiveDayCalendarSample;
async function main(){try{
 const identity=(await pool.query('SELECT current_database() db,current_user role')).rows[0];assert.equal(identity.db,'signalx_alpha217_ci');assert.equal(identity.role,'test_only');
 await pool.query('CREATE TABLE public.swing_universe_observations(trade_date date,code text,rule_version text,return_5d numeric,outcome_5d_date date)');
 const put=(code,day,outcome,ret,rule='ai_power_only_v1')=>pool.query('INSERT INTO public.swing_universe_observations VALUES($1,$2,$3,$4,$5)',[day,code,rule,ret,outcome]);
 // 266 empty sample, 267 correct 5-session date, 268 wrong target,
 // 269 missing date, 270 missing return, 271 holiday, 272 signal closure,
 // 273 rule isolation, 274 request limit, 275 owner route/static UI boundary.
 assert.equal((await read()).inspected,0);
 await put('590A','2026-10-09','2026-10-19',2);assert.equal((await read()).issues.length,0);
 await put('641A','2026-10-09','2026-10-20',2);assert.ok((await read()).issues.some(x=>x.reason==='FIVE_DAY_TARGET_MISMATCH'));
 await put('642A','2026-10-09',null,2);assert.ok((await read()).issues.some(x=>x.reason==='RETURN_MISSING_OUTCOME_DATE'));
 await put('1001','2026-10-09','2026-10-19',null);assert.ok((await read()).issues.some(x=>x.reason==='DATE_MISSING_RETURN'));
 await put('1002','2026-10-09','2026-10-12',2);assert.ok((await read()).issues.some(x=>x.reason==='OUTCOME_NOT_TSE_SESSION'));
 await put('1003','2026-10-12','2026-10-19',2);assert.ok((await read()).issues.some(x=>x.reason==='SIGNAL_NOT_TSE_SESSION'));
 await put('9999','2026-10-09','2026-10-20',2,'other_v1');assert.equal((await read()).inspected,6);
 const limited=await read(2);assert.equal(limited.inspected,2);assert.equal(limited.limitReached,true);await assert.rejects(read(101),/INVALID_CALENDAR_SAMPLE_LIMIT/);
 const route=fs.readFileSync('app/api/admin/integrated-research-review/route.ts','utf8'),page=fs.readFileSync('app/admin/research-review/page.tsx','utf8');
 assert.ok(route.indexOf('if(!owner.isOwner)')<route.indexOf('getIntegratedResearchReview()'));assert.match(page,/calendarSample/);
 console.log('PASS stages266-275: isolated PostgreSQL reader and 10 checks; no production writes');
}finally{await pool.end()}}main().catch(e=>{console.error(e);process.exitCode=1});
