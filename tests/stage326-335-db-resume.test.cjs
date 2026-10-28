const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{Pool}=require('pg');
const raw=process.env.SIGNALX_E2E_DATABASE_URL||'',u=new URL(raw);
for(const [k,v] of Object.entries({protocol:'postgres:',hostname:'127.0.0.1',port:'5432',username:'test_only',pathname:'/signalx_alpha217_ci',search:'',hash:''}))assert.equal(u[k],v);
const pool=new Pool({connectionString:raw,ssl:false});
function load(path){const m={exports:{}};new vm.Script(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText).runInNewContext({module:m,exports:m.exports,Number});return m.exports}
const decide=load('app/lib/learning/swingAuditResumeGuard.ts').decideAuditResume;
const schema=fs.readFileSync('tests/fixtures/stage306-progress-schema.ts','utf8').match(/export const AUDIT_PROGRESS_FIXTURE_SQL=`([\s\S]*?)`;/)[1];
async function state(db,auditId){
 const p=(await db.query('SELECT * FROM public.test_research_audit_progress WHERE audit_id=$1',[auditId])).rows[0];
 const q=await db.query(`SELECT COUNT(*) FILTER(WHERE return_5d IS NOT NULL OR outcome_5d_date IS NOT NULL)::integer AS eligible,
 md5(COALESCE(string_agg(trade_date::text||':'||code||':'||COALESCE(return_5d::text,'NULL')||':'||COALESCE(outcome_5d_date::text,'NULL'),'|' ORDER BY trade_date,code),'EMPTY')) AS digest
 FROM public.swing_universe_observations WHERE rule_version=$1`,[p.rule_version]);
 return decide({auditId:p.audit_id,ruleVersion:'ai_power_only_v1',storedRuleVersion:p.rule_version,
 storedFingerprint:p.snapshot_fingerprint,currentFingerprint:q.rows[0].digest,
 eligibleAtStart:p.eligible_at_start,eligibleNow:q.rows[0].eligible,inspected:p.inspected,
 cursorDate:p.cursor_date?String(p.cursor_date).slice(0,10):null,cursorCode:p.cursor_code,completed:p.completed});
}
async function main(){try{
 const id=(await pool.query('SELECT current_database() db,current_user role')).rows[0];assert.equal(id.db,'signalx_alpha217_ci');assert.equal(id.role,'test_only');
 await pool.query('CREATE TABLE public.swing_universe_observations(trade_date date,code text,rule_version text,return_5d numeric,outcome_5d_date date)');
 await pool.query(schema);
 const put=(code,ret=2,rule='ai_power_only_v1')=>pool.query('INSERT INTO public.swing_universe_observations VALUES($1,$2,$3,$4,$5)',['2026-10-09',code,rule,ret,'2026-10-19']);
 await put('590A');await put('641A');
 const fp=async()=> (await pool.query(`SELECT md5(COALESCE(string_agg(trade_date::text||':'||code||':'||COALESCE(return_5d::text,'NULL')||':'||COALESCE(outcome_5d_date::text,'NULL'),'|' ORDER BY trade_date,code),'EMPTY')) AS digest FROM public.swing_universe_observations WHERE rule_version='ai_power_only_v1'`)).rows[0].digest;
 const old=await fp();
 await pool.query("INSERT INTO public.test_research_audit_progress(audit_id,rule_version,eligible_at_start,inspected,cursor_date,cursor_code,snapshot_fingerprint) VALUES('audit1','ai_power_only_v1',2,1,'2026-10-09','590A',$1)",[old]);
 // 326 real reconnect read, 327 valid resume
 assert.equal((await state(pool,'audit1')).action,'RESUME');
 // 328 persisted count overrun rejected
 await assert.rejects(pool.query("UPDATE public.test_research_audit_progress SET inspected=3 WHERE audit_id='audit1'"),/check constraint/i);
 // 329 changed outcome value blocks with same count
 await pool.query("UPDATE public.swing_universe_observations SET return_5d=5 WHERE code='590A'");
 assert.ok((await state(pool,'audit1')).reasons.includes('DATASET_CHANGED'));
 // 330 changed date blocks
 await pool.query("UPDATE public.swing_universe_observations SET return_5d=2,outcome_5d_date='2026-10-20' WHERE code='590A'");
 assert.ok((await state(pool,'audit1')).reasons.includes('DATASET_CHANGED'));
 // 331 added observation blocks
 await put('642A');assert.ok((await state(pool,'audit1')).reasons.includes('ELIGIBLE_COUNT_CHANGED'));
 // 332 different rule must not affect scoped fingerprint
 await pool.query("DELETE FROM public.swing_universe_observations WHERE code='642A'");
 await pool.query("UPDATE public.swing_universe_observations SET outcome_5d_date='2026-10-19' WHERE code='590A'");
 await put('9999',100,'different_rule');assert.equal((await state(pool,'audit1')).action,'RESUME');
 // 333 invalid stored fingerprint blocks
 await pool.query("UPDATE public.test_research_audit_progress SET snapshot_fingerprint='bad' WHERE audit_id='audit1'");
 assert.ok((await state(pool,'audit1')).reasons.includes('INVALID_FINGERPRINT'));
 // 334 completed audit blocks
 await pool.query("UPDATE public.test_research_audit_progress SET snapshot_fingerprint=$1,inspected=2,cursor_code='641A',completed=true WHERE audit_id='audit1'",[old]);
 assert.ok((await state(pool,'audit1')).reasons.includes('ALREADY_COMPLETED'));
 // 335 pure read-only guard and no production connectivity
 assert.doesNotMatch(fs.readFileSync('app/lib/learning/swingAuditResumeGuard.ts','utf8'),/pool.query|INSERT INTO|UPDATE public|DELETE FROM/);
 console.log('PASS stages326-335: persisted real database reads, resume, drift, scopes and completion guard');
}finally{await pool.end()}}main().catch(e=>{console.error(e);process.exitCode=1});
