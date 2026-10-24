// Research-only deterministic tests. Run: node --test tests/research/dualSurgeDetectors.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {inspectDualSurge,COHORTS,DUAL_SURGE_VERSION} from "../../app/lib/research/dualSurgeDetectors.mjs";

function candles(n=22, {close=100,volume=1000}={}) {
 return Array.from({length:n},(_,i)=>({
  time:1_700_000_000+i*86400,
  open:close,high:close+1,low:close-1,close,volume
 }));
}
function last(bars,patch) {
 const next=bars.map(x=>({...x}));
 Object.assign(next.at(-1),patch);
 return next;
}

test("version and cohort labels are explicit",()=>{
 assert.equal(DUAL_SURGE_VERSION,"DUAL_SURGE_20261023_V1");
 assert.equal(COHORTS.PRE,"PRE_SURGE_V1");
 assert.equal(COHORTS.START,"SURGE_START_V1");
});
test("insufficient history fails closed",()=>{
 assert.deepEqual(inspectDualSurge(candles(21)),{available:false,reason:"INSUFFICIENT_HISTORY",signals:[]});
});
test("breakout uses previous 20 highs, not the current high",()=>{
 const bars=last(candles(),{open:100,high:110,low:99,close:105,volume:1600});
 const result=inspectDualSurge(bars);
 assert.equal(result.available,true);
 assert.equal(result.features.high20,101);
 assert.equal(result.signals.length,1);
 assert.equal(result.signals[0].cohort,COHORTS.START);
 assert.ok(result.features.highDistance>0);
});
test("today's high spike without closing breakout does not trigger START",()=>{
 const bars=last(candles(),{open:100,high:110,low:99,close:100,volume:1600});
 const result=inspectDualSurge(bars);
 assert.equal(result.available,true);
 assert.equal(result.signals.some(s=>s.cohort===COHORTS.START),false);
});
test("PRE signal can occur below prior 20-day high with positive 5-day trend",()=>{
 const bars=candles();
 // previous high 105, close below high and above yesterday and 5 sessions prior.
 bars[1].high=105;
 bars[20].close=100;bars[20].high=101;
 bars[21]={...bars[21],open:100,high:104,low:99,close:103,volume:1100};
 const result=inspectDualSurge(bars);
 assert.equal(result.available,true);
 assert.equal(result.signals[0]?.cohort,COHORTS.PRE);
 assert.equal(result.signals.some(s=>s.cohort===COHORTS.START),false);
});
test("future appended bars cannot alter a historical as-of signal",()=>{
 const bars=last(candles(),{open:100,high:110,low:99,close:105,volume:1600});
 const before=inspectDualSurge(bars,21);
 const after=inspectDualSurge([...bars,{time:bars.at(-1).time+86400,open:105,high:150,low:104,close:140,volume:9000}],21);
 assert.deepEqual(after,before);
});
test("zero volume baseline is unavailable",()=>{
 const bars=candles(22,{volume:0});
 assert.equal(inspectDualSurge(bars).reason,"VOLUME_BASELINE_UNAVAILABLE");
});
test("invalid OHLCV fails closed",()=>{
 const bars=last(candles(),{high:98});
 assert.equal(inspectDualSurge(bars).reason,"INVALID_OHLCV");
});
test("out-of-order timestamps fail closed",()=>{
 const bars=candles();
 bars[20].time=bars[19].time;
 assert.equal(inspectDualSurge(bars).reason,"INVALID_CHRONOLOGY");
});
test("invalid as-of index is rejected",()=>{
 assert.equal(inspectDualSurge(candles(),22).reason,"INSUFFICIENT_HISTORY");
 assert.equal(inspectDualSurge(candles(),-1).reason,"INSUFFICIENT_HISTORY");
});
test("a START threshold requires both momentum and volume",()=>{
 const highVolumeButLowMove=last(candles(),{open:100,high:104,low:99,close:102,volume:3000});
 const highMoveButLowVolume=last(candles(),{open:100,high:110,low:99,close:105,volume:1100});
 assert.equal(inspectDualSurge(highVolumeButLowMove).signals.some(s=>s.cohort===COHORTS.START),false);
 assert.equal(inspectDualSurge(highMoveButLowVolume).signals.some(s=>s.cohort===COHORTS.START),false);
});

// Route-level tests remain TODO: corporate-action AdjFactor missing/non-numeric,
// consecutive/nonconsecutive event grouping, future split invalidation,
// pending horizons, duplicate provider rows and next-open execution.
// They are not exercised by this pure detector test suite.
