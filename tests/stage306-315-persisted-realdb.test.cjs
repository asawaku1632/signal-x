const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{Pool}=require('pg'),crypto=require('node:crypto');
const raw=process.env.SIGNALX_E2E_DATABASE_URL||'',url=new URL(raw);
for(const [k,v] of Object.entries({protocol:'postgres:',hostname:'127.0.0.1',port:'5432',username:'test_only',pathname:'/signalx_alpha217_ci',search:'',hash:''}))assert.equal(url[k],v);
const pool=new Pool({connectionString:raw,ssl:false});
const schema=fs.readFileSync('tests/fixtures/stage306-progress-schema.ts','utf8').match(/export const AUDIT_PROGRESS_FIXTURE_SQL=`([\s\S]*?)`;/)[1];
const fingerprint=async(client)=>{const r=await client.query("SELECT md5(COALESCE(string_agg(trade_date::text || ':' || code || ':' || COALESCE(return_5d::text,'NULL') || ':' || COALESCE(outcome_5d_date::text,'NULL'),'|' ORDER BY trade_date,code),'EMPTY')) AS digest FROM public.swing_universe_observations WHERE rule_version=$1",['ai_power_only_v1']);return r.rows[0].digest;};
async function main(){const client=await pool.connect();try{
 await client.query('CREATE TABLE public.swing_universe_observations(trade_date date,code text,rule_version text,return_5d numeric,outcome_5d_date date)');
 await client.query(schema);
 const insert=async(code,ret=2)=>client.query('INSERT INTO public.swing_universe_observations VALUES($1,$2,$3,$4,$5)', ['2026-10-09',code,'ai_power_only_v1',ret,'2026-10-19']);
 await insert('590A');await insert('641A');const digest=await fingerprint(client);
 // 306 schema and 307 initial insert persisted
 await client.query("INSERT INTO public.test_research_audit_progress(audit_id,rule_version,eligible_at_start,snapshot_fingerprint) VALUES('test1','ai_power_only_v1',2,$1)",[digest]);
 let p=(await client.query("SELECT * FROM public.test_research_audit_progress WHERE audit_id='test1'")).rows[0];assert.equal(p.inspected,0);
 // 308 update progress and 309 read it back from a fresh connection
 await client.query("UPDATE public.test_research_audit_progress SET inspected=1,issue_count=0,cursor_date='2026-10-09',cursor_code='590A' WHERE audit_id='test1'");
 p=(await pool.query("SELECT * FROM public.test_research_audit_progress WHERE audit_id='test1'")).rows[0];assert.equal(p.inspected,1);assert.equal(p.cursor_code,'590A');
 // 310 resume remaining page and 311 completion
 const remaining=(await client.query("SELECT code FROM public.swing_universe_observations WHERE code>$1 ORDER BY code", [p.cursor_code])).rows;assert.deepEqual(remaining.map(x=>x.code),['641A']);
 await client.query("UPDATE public.test_research_audit_progress SET inspected=2,cursor_code='641A',completed=true WHERE audit_id='test1'");
 p=(await client.query("SELECT * FROM public.test_research_audit_progress WHERE audit_id='test1'")).rows[0];assert.equal(p.completed,true);
 // 312 invalid overrun rejected, 313 invalid issue count rejected
 await assert.rejects(client.query("UPDATE public.test_research_audit_progress SET inspected=3 WHERE audit_id='test1'"),/check constraint/i);
 await assert.rejects(client.query("UPDATE public.test_research_audit_progress SET issue_count=3 WHERE audit_id='test1'"),/check constraint/i);
 // 314 data drift detected; subsequent pages cannot be considered same frozen snapshot
 await insert('642A');const changed=await fingerprint(client);assert.notEqual(changed,p.snapshot_fingerprint);
 // 315 mutation of existing outcome also detected
 await client.query("UPDATE public.swing_universe_observations SET return_5d=4 WHERE code='590A'");
 assert.notEqual(await fingerprint(client),changed);
 console.log('PASS stages306-315: persisted cursor/progress, reconnect/resume, integrity constraints, insert/update fingerprint drift');
}finally{client.release();await pool.end()}}
main().catch(e=>{console.error(e);process.exitCode=1});
