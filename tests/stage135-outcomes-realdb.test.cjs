'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const {Pool}=require('pg');
async function main(){
 const url=process.env.SIGNALX_E2E_DATABASE_URL||'';
 const u=new URL(url);
 assert.equal(u.protocol,'postgres:');
 assert.equal(u.hostname,'127.0.0.1');
 assert.equal(u.port,'5432');
 assert.equal(u.username,'test_only');
 assert.equal(u.pathname,'/signalx_alpha217_ci');
 assert.equal(u.search,'');
 assert.equal(u.hash,'');
 const pool=new Pool({connectionString:url,ssl:false});
 try{
  const identity=await pool.query('SELECT current_database() db,current_user role');
  assert.equal(identity.rows[0].db,'signalx_alpha217_ci');
  assert.equal(identity.rows[0].role,'test_only');
  await pool.query('CREATE TABLE public.daily_stock_results(date text NOT NULL,code text NOT NULL,name text NOT NULL,score numeric,price double precision)');
  await pool.query(`CREATE TABLE public.swing_universe_observations(
   trade_date date NOT NULL,code text NOT NULL,name text NOT NULL,
   entry_price double precision NOT NULL,ai_power numeric NOT NULL,
   decision_status text NOT NULL,decision_label text NOT NULL,rule_version text NOT NULL,
   outcome_1d_date date,outcome_3d_date date,outcome_5d_date date,outcome_10d_date date,
   return_1d numeric,return_3d numeric,return_5d numeric,return_10d numeric,
   updated_at timestamptz,UNIQUE(trade_date,code))`);
  const signal='2026-10-01', target='2026-10-20';
  const sessions=['2026-10-02','2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-12','2026-10-13','2026-10-14','2026-10-15'];
  const stocks=['590A','641A','642A','7203','1301'];
  for(const code of stocks){
   await pool.query('INSERT INTO public.swing_universe_observations(trade_date,code,name,entry_price,ai_power,decision_status,decision_label,rule_version) VALUES($1,$2,$3,100,70,$4,$5,$6)',
   [signal,code,code,'WATCH','ResearchOnly','ai_power_only_v1']);
   for(let i=0;i<sessions.length;i++){
    // Each completed return is deterministic: +1%, +3%, +5%, +10%.
    const price=(i+1)*1+100;
    await pool.query('INSERT INTO public.daily_stock_results(date,code,name,score,price) VALUES($1,$2,$3,70,$4)',[sessions[i],code,code,price]);
   }
  }
  // Missing exact-date outcome must remain NULL, not borrow an adjacent day.
  await pool.query('DELETE FROM public.daily_stock_results WHERE code=$1 AND date=$2',['642A',sessions[4]]);
  const source=fs.readFileSync('app/lib/learning/swingUniverseAudit.ts','utf8');
  assert.ok(source.includes('/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/'));
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const imports={
   '@/app/lib/postgres':{__esModule:true,default:pool},
   '@/app/lib/learning/scanEngine':{getFallbackTotalStockList:()=>5},
   '@/app/lib/learning/dailyScanGuard':{validateDailyScanCoverage:()=>({valid:true,minimumCount:4})},
   '@/app/lib/swingDecision':{getSwingEntryDecision:()=>({status:'WATCH',label:'ResearchOnly'})},
   '@/app/lib/learning/swingSameDayRelative':{summarizeSameDayRelative:()=>({})},
   '@/app/lib/technicalObservation/tseMarketCalendar':{
    isTseTradingDate:(d)=>[signal,target].includes(d),
    isTseTargetDateReady:()=>true,
    resolveTseTradingDatesAfter:()=>sessions
   }
  };
  const module={exports:{}};
  new vm.Script(js).runInNewContext({module,exports:module.exports,
   require:(key)=>{assert.ok(Object.hasOwn(imports,key),'Unknown dependency '+key);return imports[key];},
   Date,console,process,Buffer,setTimeout,clearTimeout});
  const update=module.exports.updateSwingUniverseOutcomes;
  assert.equal(typeof update,'function');
  const first=await update(target);
  assert.equal(first.pendingDates,1);
  assert.equal(first.updated[1],5);
  assert.equal(first.updated[3],5);
  assert.equal(first.updated[5],4);
  assert.equal(first.updated[10],5);
  let rows=(await pool.query('SELECT code,return_1d,return_3d,return_5d,return_10d,outcome_5d_date FROM public.swing_universe_observations ORDER BY code')).rows;
  for(const row of rows){
   assert.equal(Number(row.return_1d),1);
   assert.equal(Number(row.return_3d),3);
   assert.equal(Number(row.return_10d),10);
   if(row.code==='642A'){assert.equal(row.return_5d,null);assert.equal(row.outcome_5d_date,null);}
   else assert.equal(Number(row.return_5d),5);
  }
  const second=await update(target);
  assert.deepEqual(Object.values(second.updated),[0,0,0,0]);
  rows=(await pool.query('SELECT count(*)::integer n FROM public.swing_universe_observations')).rows;
  assert.equal(rows[0].n,5);
  console.log('PASS stage135: 1d=5, 3d=5, 5d=4 (missing=1), 10d=5, repeat=0, observations=5');
 }finally{await pool.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
