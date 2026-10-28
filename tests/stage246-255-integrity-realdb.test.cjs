const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{Pool}=require('pg');
const url=process.env.SIGNALX_E2E_DATABASE_URL||'',u=new URL(url);
for(const [k,v] of Object.entries({protocol:'postgres:',hostname:'127.0.0.1',port:'5432',username:'test_only',pathname:'/signalx_alpha217_ci',search:'',hash:''}))assert.equal(u[k],v);
const pool=new Pool({connectionString:url,ssl:false});
const source=fs.readFileSync('app/lib/learning/swingObservationIntegrity.ts','utf8'),m={exports:{}};
new vm.Script(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText).runInNewContext({module:m,exports:m.exports,require:k=>k==='@/app/lib/postgres'?{default:pool}:k==='@/app/lib/learning/swingUniverseAudit'?{UNIVERSE_SWING_RULE_VERSION:'ai_power_only_v1'}:(()=>{throw Error(k)})(),Number,Object});
const check=m.exports.readSwingObservationIntegrity;
async function main(){
 try{
  const ident=(await pool.query('select current_database() db,current_user role')).rows[0];
  assert.equal(ident.db,'signalx_alpha217_ci');assert.equal(ident.role,'test_only');
  await pool.query(`CREATE TABLE public.swing_universe_observations(
    trade_date date NOT NULL,code text NOT NULL,rule_version text NOT NULL,
    entry_price numeric,return_5d numeric,outcome_5d_date date
  )`);
  const insert=async (code,entry,ret,day)=>pool.query('INSERT INTO public.swing_universe_observations(trade_date,code,rule_version,entry_price,return_5d,outcome_5d_date) VALUES($1,$2,$3,$4,$5,$6)', ['2026-10-01',code,'ai_power_only_v1',entry,ret,day]);
  await insert('1001',100,2,'2026-10-08');
  let r=await check();
  assert.equal(r.metrics.total,1);assert.equal(r.metrics.evaluated,1);assert.equal(r.issues.length,0);
  await insert('1002',100,1,null);r=await check();assert.ok(r.issues.includes('RETURN_WITHOUT_TARGET_DATE'));
  await insert('1003',100,null,'2026-10-08');r=await check();assert.ok(r.issues.includes('TARGET_DATE_WITHOUT_RETURN'));
  await insert('1004',100,2,'2026-09-30');r=await check();assert.ok(r.issues.includes('TARGET_DATE_NOT_AFTER_SIGNAL'));
  await insert('1005',0,2,'2026-10-08');r=await check();assert.ok(r.issues.includes('INVALID_ENTRY_PRICE'));
  await insert('1006',100,-120,'2026-10-08');r=await check();assert.ok(r.issues.includes('OUT_OF_RANGE_RETURN'));
  await insert('1007',100,12001,'2026-10-08');r=await check();assert.equal(r.metrics.invalidReturn,2);
  await pool.query(`INSERT INTO public.swing_universe_observations VALUES('2026-10-01','9999','other_v1',0,50000,'2026-09-01')`);
  r=await check();assert.equal(r.metrics.total,7);assert.equal(r.metrics.evaluated,6);
  assert.equal(r.metrics.distinctDays,1);assert.equal(r.sourceVerified,false);assert.equal(r.licenseVerified,false);
  assert.equal(r.adoptionApproved,false);assert.equal(r.productionApplied,false);
  console.log('PASS stages246-255: 10 real SQL assertions including abnormal dates/prices/returns and rule isolation');
 }finally{await pool.end()}
}main().catch(e=>{console.error(e);process.exitCode=1});
