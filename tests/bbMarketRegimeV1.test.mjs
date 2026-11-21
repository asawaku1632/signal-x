import test from "node:test";
import assert from "node:assert/strict";
import {validateBenchmarkCloses,priorMarketRegime,compareBuyEventsByMarketRegime} from "../app/lib/research/bbMarketRegimeV1.mjs";
import {resolveTseTradingDatesAfter} from "../app/lib/technicalObservation/tseMarketCalendar.ts";
const dates=["2026-10-01",...resolveTseTradingDatesAfter("2026-10-01",9)];
const bars=dates.map((date,i)=>({date,close:100+i*1.5}));
test("prior-day regime ignores same-day or future closes",()=>{
 const a=validateBenchmarkCloses(bars);
 const d=dates[8];
 const old=priorMarketRegime(d,a);
 const tampered=a.map(x=>x.date>=d?{...x,close:1}:x);
 assert.deepEqual(priorMarketRegime(d,tampered),old);
 assert.equal(old.regime,"UP");
 assert.ok(old.asOfDate<d);
});
test("missing prior session or index bars never silently forward-filled",()=>{
 const a=validateBenchmarkCloses(bars);
 assert.equal(priorMarketRegime("2026-11-04",a).regime,"UNKNOWN");
 assert.throws(()=>validateBenchmarkCloses(bars.filter((_,i)=>i!==4)),/MISSING_BENCHMARK_TRADING_DAY/);
});
test("tiny sample labels only; no predictive win rate",()=>{
 const a=validateBenchmarkCloses(bars);
 const v=compareBuyEventsByMarketRegime([{code:"3762",date:dates[8],slot:"09:20",
   intradayNetPct:-0.5,after5dPct:12,patterns:["MARUBOZU"],intradayWorstDipPct:-1}],a);
 assert.equal(v.rows[0].marketRegime,"UP");
 assert.equal(v.summary.UP.mature5,1);
 assert.equal(v.summary.UP.positive5dPct,null);
 assert.equal(v.eligibleForProduction,false);
});
