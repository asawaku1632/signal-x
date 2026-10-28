'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const {Pool}=require('pg');
function load(path,imports,Clock=Date){
 const source=fs.readFileSync(path,'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 new vm.Script(js,{filename:path}).runInNewContext({module,exports:module.exports,require:key=>{
  assert.ok(Object.hasOwn(imports,key),'Unexpected module '+key);return imports[key];
 },Date:Clock,Intl,Set,console,process,Buffer,setTimeout,clearTimeout});
 return module.exports;
}
async function main(){
 const raw=process.env.SIGNALX_E2E_DATABASE_URL||'';
 const url=new URL(raw);
 assert.equal(url.protocol,'postgres:');
 assert.equal(url.hostname,'127.0.0.1');
 assert.equal(url.port,'5432');
 assert.equal(url.username,'test_only');
 assert.equal(url.pathname,'/signalx_alpha217_ci');
 assert.equal(url.search,'');
 assert.equal(url.hash,'');
 const pool=new Pool({connectionString:raw,ssl:false});
 try{
  const identity=await pool.query('SELECT current_database() db,current_user role');
  assert.equal(identity.rows[0].db,'signalx_alpha217_ci');
  assert.equal(identity.rows[0].role,'test_only');
  await pool.query('CREATE TABLE public.daily_stock_results(date text NOT NULL,code text NOT NULL,name text NOT NULL,score numeric,price double precision)');
  await pool.query(`CREATE TABLE public.swing_universe_observations(
   trade_date date NOT NULL,code text NOT NULL,name text NOT NULL,
   entry_price double precision NOT NULL CHECK(entry_price>0),ai_power numeric NOT NULL CHECK(ai_power BETWEEN 0 AND 100),
   decision_status text NOT NULL,decision_label text NOT NULL,rule_version text NOT NULL,
   outcome_1d_date date,outcome_3d_date date,outcome_5d_date date,outcome_10d_date date,
   return_1d numeric,return_3d numeric,return_5d numeric,return_10d numeric,
   updated_at timestamptz,UNIQUE(trade_date,code))`);
  const calendar=load('app/lib/technicalObservation/tseMarketCalendar.ts',{});
  const day='2026-10-01', target='2026-10-20';
  const sessions=calendar.resolveTseTradingDatesAfter(day,10,{maxLookaheadDays:45});
  assert.equal(sessions[9],'2026-10-16');
  assert.equal(calendar.isTseTradingDate('2026-10-12'),false);
  const stocks=['590A','641A','642A','7203','1301'];
  for(const code of stocks)await pool.query('INSERT INTO public.daily_stock_results(date,code,name,score,price) VALUES($1,$2,$3,70,100)',[day,code,code]);
  const audit=load('app/lib/learning/swingUniverseAudit.ts',{
   '@/app/lib/postgres':{__esModule:true,default:pool},
   '@/app/lib/learning/scanEngine':{getFallbackTotalStockList:()=>5},
   '@/app/lib/learning/dailyScanGuard':{validateDailyScanCoverage:(n,total)=>({valid:n>=Math.ceil(total*.8),minimumCount:Math.ceil(total*.8)})},
   '@/app/lib/swingDecision':{getSwingEntryDecision:({aiPower})=>({status:aiPower<65?'AVOID':aiPower<75?'WATCH':aiPower<85?'WAIT':'CANDIDATE',label:'ResearchOnly'})},
   '@/app/lib/learning/swingSameDayRelative':{summarizeSameDayRelative:()=>({})},
   '@/app/lib/technicalObservation/tseMarketCalendar':calendar
  });
  let reason='PREVIOUS_TSE_TRADING_DAY_BEFORE_SAFE_BOUNDARY',unauthorized=false;
  class Clock extends Date{
   constructor(...args){super(...(args.length?args:['2026-10-01T08:00:00Z']));}
   static now(){return Date.parse('2026-10-01T08:00:00Z');}
  }
  const route=load('app/api/cron/swing-universe-audit/route.ts',{
   'next/server':{NextResponse:{json:(data,opts)=>({data,opts})}},
   '@/app/lib/cronAuth':{requireCronAuth:()=>unauthorized?{status:401}:null},
   '@/app/lib/learning/swingUniverseAudit':{
    captureSwingUniverseDay:audit.captureSwingUniverseDay,
    updateSwingUniverseOutcomes:audit.updateSwingUniverseOutcomes
   },
   '@/app/lib/technicalObservation/tseMarketCalendar':{
    resolveTargetTradeDate:()=>({targetTradeDate:day,targetTradeDateReason:reason})
   }
  },Clock);
  const count=async()=>Number((await pool.query('SELECT count(*)::int n FROM public.swing_universe_observations')).rows[0].n);
  unauthorized=true;
  assert.equal((await route.GET({})).status,401);
  assert.equal(await count(),0);
  unauthorized=false;
  let response=await route.GET({});
  assert.equal(response.data.capture.saved,0);
  assert.equal(response.data.capture.skipped,'NON_CURRENT_TRADE_DATE');
  assert.equal(await count(),0);
  reason='CURRENT_TSE_TRADING_DAY_AFTER_SAFE_BOUNDARY';
  response=await route.GET({});
  assert.equal(response.data.capture.saved,5);
  assert.equal(await count(),5);
  response=await route.GET({});
  assert.equal(response.data.capture.saved,0);
  const captured=(await pool.query('SELECT code,entry_price FROM public.swing_universe_observations ORDER BY code')).rows;
  assert.deepEqual(captured.map(row=>row.code),['1301','590A','641A','642A','7203']);
  assert.ok(captured.every(row=>Number(row.entry_price)===100));
  for(const code of stocks)for(let i=0;i<sessions.length;i++){
   if(code==='642A'&&i===4)continue;
   await pool.query('INSERT INTO public.daily_stock_results(date,code,name,score,price) VALUES($1,$2,$3,70,$4)',
    [sessions[i],code,code,101+i]);
  }
  let first=await audit.updateSwingUniverseOutcomes(target);
  assert.deepEqual(Array.from([1,3,5,10],n=>first.updated[n]),[5,5,4,5]);
  let incomplete=(await pool.query('SELECT return_5d FROM public.swing_universe_observations WHERE code=$1',['642A'])).rows[0];
  assert.equal(incomplete.return_5d,null);
  // A complete 10-day result must not prevent later recovery of missing 5-day data.
  await pool.query('INSERT INTO public.daily_stock_results(date,code,name,score,price) VALUES($1,$2,$3,70,105)',[sessions[4],'642A','642A']);
  await pool.query('UPDATE public.daily_stock_results SET price=900 WHERE code=$1 AND date=$2',['590A',sessions[0]]);
  let recovery=await audit.updateSwingUniverseOutcomes(target);
  assert.deepEqual(Array.from([1,3,5,10],n=>recovery.updated[n]),[0,0,1,0]);
  const saved=(await pool.query('SELECT code,return_1d,return_3d,return_5d,return_10d FROM public.swing_universe_observations ORDER BY code')).rows;
  for(const row of saved){
   assert.equal(Number(row.return_1d),1);
   assert.equal(Number(row.return_3d),3);
   assert.equal(Number(row.return_5d),5);
   assert.equal(Number(row.return_10d),10);
  }
  const repeat=await audit.updateSwingUniverseOutcomes(target);
  assert.deepEqual(Array.from([1,3,5,10],n=>repeat.updated[n]),[0,0,0,0]);
  assert.equal(await count(),5);
  await assert.rejects(()=>audit.updateSwingUniverseOutcomes('2028-01-05'),/MARKET_CALENDAR_UNAVAILABLE/);
  assert.equal(await count(),5);
  console.log('PASS stage141-145: unauthorized=0 writes, preclose=0, capture=5, repeat capture=0, real 1/3/5/10 outcome SQL, late recovery=1, frozen=preserved, replay=0, out-of-range=fail closed');
 }finally{await pool.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
