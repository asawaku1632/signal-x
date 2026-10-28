'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const {Pool}=require('pg');
function load(file,imports,Clock=Date){
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 new vm.Script(js,{filename:file}).runInNewContext({module,exports:module.exports,require:(key)=>{assert.ok(Object.hasOwn(imports,key),'unexpected import: '+key);return imports[key];},Date:Clock,console,process,Buffer,setTimeout,clearTimeout});
 return module.exports;
}
async function main(){
 const raw=process.env.SIGNALX_E2E_DATABASE_URL||'';
 const u=new URL(raw);
 assert.equal(u.protocol,'postgres:');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,'5432');
 assert.equal(u.username,'test_only');assert.equal(u.pathname,'/signalx_alpha217_ci');assert.equal(u.search,'');assert.equal(u.hash,'');
 const pool=new Pool({connectionString:raw,ssl:false});
 try{
  const id=await pool.query('SELECT current_database() AS db,current_user AS role');
  assert.equal(id.rows[0].db,'signalx_alpha217_ci');assert.equal(id.rows[0].role,'test_only');
  await pool.query('CREATE TABLE public.daily_stock_results(date text NOT NULL,code text NOT NULL,name text NOT NULL,score numeric,price double precision)');
  await pool.query('CREATE TABLE public.swing_universe_observations(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,trade_date date NOT NULL,code text NOT NULL,name text NOT NULL,entry_price double precision NOT NULL CHECK(entry_price>0),ai_power numeric NOT NULL CHECK(ai_power BETWEEN 0 AND 100),decision_status text NOT NULL,decision_label text NOT NULL,rule_version text NOT NULL,UNIQUE(trade_date,code))');
  const day='2026-10-27',stocks=[['590A','Alpha1',30,100],['641A','Alpha2',70,200],['642A','Alpha3',77,300],['7203','Numeric1',90,400],['1301','Numeric2',60,500]];
  for(const row of stocks)await pool.query('INSERT INTO public.daily_stock_results(date,code,name,score,price) VALUES($1,$2,$3,$4,$5)',[day,...row]);
  assert.ok(fs.readFileSync('app/lib/learning/swingUniverseAudit.ts','utf8').includes('/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/'));
  const audit=load('app/lib/learning/swingUniverseAudit.ts',{
   '@/app/lib/postgres':{__esModule:true,default:pool},
   '@/app/lib/learning/scanEngine':{getFallbackTotalStockList:()=>5},
   '@/app/lib/learning/dailyScanGuard':{validateDailyScanCoverage:(n,total)=>({valid:n>=Math.ceil(total*.8),minimumCount:Math.ceil(total*.8)})},
   '@/app/lib/swingDecision':{getSwingEntryDecision:({aiPower})=>({status:aiPower<65?'AVOID':aiPower<75?'WATCH':aiPower<85?'WAIT':'CANDIDATE',label:'ResearchOnly'})},
   '@/app/lib/learning/swingSameDayRelative':{summarizeSameDayRelative:()=>({})},
   '@/app/lib/technicalObservation/tseMarketCalendar':{isTseTradingDate:d=>d===day,isTseTargetDateReady:()=>true,resolveTseTradingDatesAfter:()=>[]}
  });
  const routeSource=fs.readFileSync('app/api/cron/swing-universe-audit/route.ts','utf8');
  assert.ok(routeSource.includes('CURRENT_TSE_TRADING_DAY_AFTER_SAFE_BOUNDARY'));
  let reason='PREVIOUS_TSE_TRADING_DAY_BEFORE_SAFE_BOUNDARY',updated=0;
  class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-10-27T08:00:00.000Z']));}static now(){return Date.parse('2026-10-27T08:00:00.000Z');}}
  const route=load('app/api/cron/swing-universe-audit/route.ts',{
   'next/server':{NextResponse:{json:(data,options)=>({data,options})}},
   '@/app/lib/cronAuth':{requireCronAuth:()=>null},
   '@/app/lib/learning/swingUniverseAudit':{captureSwingUniverseDay:audit.captureSwingUniverseDay,updateSwingUniverseOutcomes:async()=>{updated++;return {updated:{}};}},
   '@/app/lib/technicalObservation/tseMarketCalendar':{resolveTargetTradeDate:()=>({targetTradeDate:day,targetTradeDateReason:reason})}
  },FixedDate);
  const count=async()=>Number((await pool.query('SELECT count(*)::integer AS n FROM public.swing_universe_observations')).rows[0].n);
  for(const why of ['PREVIOUS_TSE_TRADING_DAY_BEFORE_SAFE_BOUNDARY','PREVIOUS_TSE_TRADING_DAY_MARKET_CLOSED']){
   reason=why;const r=await route.GET({});assert.equal(r.data.capture.saved,0);assert.equal(r.data.capture.skipped,'NON_CURRENT_TRADE_DATE');assert.equal(await count(),0);
  }
  reason='CURRENT_TSE_TRADING_DAY_AFTER_SAFE_BOUNDARY';
  let r=await route.GET({});assert.equal(r.data.success,true);assert.equal(r.data.capture.saved,5);
  const codes=(await pool.query('SELECT code FROM public.swing_universe_observations ORDER BY code')).rows.map(x=>x.code);
  assert.deepEqual(codes,['1301','590A','641A','642A','7203']);
  r=await route.GET({});assert.equal(r.data.capture.saved,0);assert.equal(await count(),5);assert.equal(updated,4);
  console.log('PASS stage134: forbidden=0, current=5 (alpha3+numeric2), replay=0');
 }finally{await pool.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
