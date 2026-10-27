// PROPOSAL ONLY. Runs actual captureSwingUniverseDay from the checked-out
// swingUniverseAudit.ts against a disposable postgres DB. No production URL.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const {Pool}=require('pg');

async function main(){
  const url=process.env.SIGNALX_E2E_DATABASE_URL || '';
  const parsed=new URL(url);
  assert.equal(parsed.hostname,'127.0.0.1','Only loopback DB allowed');
  assert.equal(parsed.pathname,'/signalx_alpha217_ci','Only disposable database allowed');
  assert.equal(parsed.username,'test_only','Only disposable role allowed');
  assert.equal(parsed.protocol,'postgres:');
  const pool=new Pool({connectionString:url,ssl:false});
  try {
    const info=await pool.query("SELECT current_database() AS db, current_user AS role");
    assert.equal(info.rows[0].db,'signalx_alpha217_ci');
    assert.equal(info.rows[0].role,'test_only');
    // Minimal compatibility tables exist ONLY in the disposable CI service DB.
    await pool.query(`CREATE TABLE IF NOT EXISTS public.daily_stock_results
      (date text NOT NULL,code text NOT NULL,name text NOT NULL,score numeric,price double precision)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS public.swing_universe_observations (
      id bigint generated always as identity primary key,
      trade_date date not null,code text not null,name text not null,
      entry_price double precision not null check(entry_price>0),
      ai_power numeric not null check(ai_power between 0 and 100),
      decision_status text not null,decision_label text not null,
      rule_version text not null,
      unique(trade_date,code))`);
    await pool.query("TRUNCATE public.daily_stock_results, public.swing_universe_observations");
    const date='2026-10-26';
    const samples=[
      ['590A','Alpha1',30,100],['641A','Alpha2',70,200],
      ['642A','Alpha3',77,300],['7203','Numeric1',90,400],
      ['1301','Numeric2',60,500],
    ];
    for(const [code,name,score,price] of samples){
      await pool.query(`INSERT INTO public.daily_stock_results(date,code,name,score,price)
        VALUES($1,$2,$3,$4,$5)`,[date,code,name,score,price]);
    }

    const source=fs.readFileSync(path.resolve('app/lib/learning/swingUniverseAudit.ts'),'utf8');
    assert.match(source,/if \(!\/\^\(\?:\[0-9\]\{4\}\|\[0-9\]\{3\}\[A-Z\]\)\$\/\.test\(row\.code\)/,
      'Expected PR #217 patched source, not main branch');
    const js=ts.transpileModule(source,{
      compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
    }).outputText;
    const module={exports:{}};
    const dependencies={
      '@/app/lib/postgres':{__esModule:true,default:pool},
      '@/app/lib/learning/scanEngine':{getFallbackTotalStockList:()=>5},
      '@/app/lib/learning/dailyScanGuard':{
        validateDailyScanCoverage:(count,expected)=>({
          valid:count>=Math.ceil(expected*0.8),minimumCount:Math.ceil(expected*0.8)
        })
      },
      '@/app/lib/swingDecision':{getSwingEntryDecision:({aiPower})=>({
        status:aiPower<65?'AVOID':aiPower<75?'WATCH':aiPower<85?'WAIT':'CANDIDATE',
        label:'ResearchOnly'
      })},
      '@/app/lib/learning/swingSameDayRelative':{summarizeSameDayRelative:()=>({})},
      '@/app/lib/technicalObservation/tseMarketCalendar':{
        isTseTradingDate:(d)=>d===date,
        isTseTargetDateReady:()=>true,
        resolveTseTradingDatesAfter:()=>[]
      }
    };
    // Runs original TypeScript module after transpilation. Only imported
    // external dependencies are injected, not the capture function body.
    const context=vm.createContext({module,exports:module.exports,
      require:(name)=>{if(!(name in dependencies))throw Error('Unknown import '+name);
        return dependencies[name];},
      console,process,Date,Buffer,setTimeout,clearTimeout});
    new vm.Script(js,{filename:'swingUniverseAudit.compiled.cjs'}).runInContext(context);
    const fn=module.exports.captureSwingUniverseDay;
    assert.equal(typeof fn,'function');
    const first=await fn(date,new Date('2026-10-27T08:00:00Z'));
    assert.equal(first.saved,5);
    assert.equal(first.eligible,5);
    const result=await pool.query(`SELECT code FROM public.swing_universe_observations
      WHERE trade_date=$1 ORDER BY code`,[date]);
    assert.deepEqual(result.rows.map(x=>x.code),['1301','590A','641A','642A','7203']);
    const repeat=await fn(date,new Date('2026-10-27T08:00:00Z'));
    assert.equal(repeat.saved,0,'Unique-date-code conflict must be idempotent');
    const count=await pool.query('SELECT count(*)::integer AS n FROM public.swing_universe_observations');
    assert.equal(count.rows[0].n,5);
    console.log('PASS real capture function SQL: alpha=3 numeric=2, first insert=5, replay=0');

    // Combined integration: Cron date gate from PR #222 invokes the actual
    // PR #217 capture function, backed by the same disposable PostgreSQL.
    await pool.query('TRUNCATE public.swing_universe_observations');
    const routeSource=fs.readFileSync(path.resolve('app/api/cron/swing-universe-audit/route.ts'),'utf8');
    assert.match(routeSource,/NON_CURRENT_TRADE_DATE/,'Expected PR #222 route');
    const stripped=routeSource.replace(/^import .*;\\r?\\n/gm,'')
      .replace(/export const /g,'const ')
      .replace(/export async function GET/g,'async function GET');
    const routeJs=ts.transpileModule(stripped,{
      compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}
    }).outputText;
    async function viaCron(reason,auth=false){
      let captureCalls=0, outcomeCalls=0;
      const GET=new Function('NextResponse','requireCronAuth','resolveTargetTradeDate',
        'captureSwingUniverseDay','updateSwingUniverseOutcomes','console',
        routeJs+'\\nreturn GET;')(
        {json:(data,opts)=>({data,opts})},
        ()=>auth?{status:401}:null,
        ()=>({targetTradeDate:date,targetTradeDateReason:reason}),
        async(d,at)=>{captureCalls++;return fn(d,at);},
        async()=>{outcomeCalls++;return {updated:0};},
        {info:()=>{},error:()=>{}}
      );
      const response=await GET({});
      const n=(await pool.query('SELECT count(*)::integer AS n FROM public.swing_universe_observations')).rows[0].n;
      return {response,captureCalls,outcomeCalls,n};
    }
    const allowed='CURRENT_TSE_TRADING_DAY_AFTER_SAFE_BOUNDARY';
    const earlier=await viaCron('PREVIOUS_TSE_TRADING_DAY_BEFORE_SAFE_BOUNDARY');
    assert.equal(earlier.n,0);
    assert.equal(earlier.captureCalls,0);
    assert.equal(earlier.outcomeCalls,1);
    const holiday=await viaCron('PREVIOUS_TSE_TRADING_DAY_MARKET_CLOSED');
    assert.equal(holiday.n,0);
    assert.equal(holiday.captureCalls,0);
    const unauthorized=await viaCron(allowed,true);
    assert.equal(unauthorized.n,0);
    assert.equal(unauthorized.captureCalls,0);
    assert.equal(unauthorized.outcomeCalls,0);
    const accepted=await viaCron(allowed);
    assert.equal(accepted.response.data.capture.saved,5);
    assert.equal(accepted.n,5);
    assert.equal(accepted.captureCalls,1);
    const replay=await viaCron(allowed);
    assert.equal(replay.response.data.capture.saved,0);
    assert.equal(replay.n,5);
    console.log('PASS combined route + real PG: blocked=0, auth=0, allowed=5, replay=0');

  } finally {
    await pool.end();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
