import test from "node:test";
import assert from "node:assert/strict";
import {adaptHistoricalMorning,aggregateHistoricalMorning} from "../app/lib/research/morningHistoricalAdapter.mjs";
const bars=Array.from({length:30},(_,i)=>({
  time:Date.parse("2026-10-28T09:00:00+09:00")/1000+i*300,
  open:100,high:i>8?104:101,low:i===8?90:98,close:100
}));
const input={code:"590A",tradeDate:"2026-10-28",previousClose:100,
  intervalMinutes:5,bars,source:"LICENSED_TEST_FIXTURE",licenseVerified:true,
  timestampSemantics:"BAR_START",exchangeTimezone:"Asia/Tokyo"};
test("offline JST adapter extracts historical bottom and aggregates",()=>{
  const outcome=adaptHistoricalMorning(input);
  assert.equal(outcome.valid,true);
  assert.equal(outcome.bottomWindow,"09:40");
  const stats=aggregateHistoricalMorning([input],{minSamples:1,dropThresholdPct:2});
  assert.equal(stats.samples,1);
  assert.equal(stats.topWindows[0].windowStart,"09:40");
  assert.equal(stats.rebound2pct.rate,100);
});
test("fail closed on missing license, timestamp semantics, or incomplete bars",()=>{
  assert.equal(adaptHistoricalMorning({...input,licenseVerified:false}).valid,false);
  assert.equal(adaptHistoricalMorning({...input,timestampSemantics:"BAR_END"}).valid,false);
  assert.equal(adaptHistoricalMorning({...input,bars:bars.slice(1)}).valid,false);
});

test("reports rejected source and incomplete bars without claiming independent authentication",()=>{
  const summary=aggregateHistoricalMorning([
    input,{...input,code:"1234",licenseVerified:false},
    {...input,code:"5678",bars:bars.slice(1)},
    {...input,code:"9012",source:" "}
  ],{minSamples:1,dropThresholdPct:2});
  assert.equal(summary.samples,1);
  assert.equal(summary.sourceCoverage.received,4);
  assert.equal(summary.sourceCoverage.structurallyValid,1);
  assert.equal(summary.sourceCoverage.rejected,3);
  assert.equal(summary.sourceCoverage.rejectedByReason.UNVERIFIED_SOURCE_OR_METADATA,2);
  assert.equal(summary.sourceCoverage.rejectedByReason.INCOMPLETE_MORNING_BARS,1);
  assert.equal(summary.sourceCoverage.independentlyAuthenticated,false);
});

test("out-of-range Unix seconds fail closed while other stocks remain reportable",()=>{
  const huge={...input,code:"1234",bars:[{...bars[0],time:Number.MAX_SAFE_INTEGER},...bars.slice(1)]};
  assert.deepEqual(adaptHistoricalMorning(huge),{valid:false,reason:"INVALID_TIMESTAMP"});
  const report=aggregateHistoricalMorning([input,huge],{minSamples:1,dropThresholdPct:2});
  assert.equal(report.sourceCoverage.received,2);
  assert.equal(report.sourceCoverage.rejectedByReason.INVALID_TIMESTAMP,1);
  assert.equal(report.samples,1);
});

test("stored shadow research run summaries cannot masquerade as complete intraday bars",()=>{
  const storedRun={detector_version:"SHADOW",requested_count:500,succeeded_count:480,
    aggregate:{total:480},events:[{code:"590A",signal:"PATTERN"}],excluded:[]};
  assert.equal(adaptHistoricalMorning(storedRun).valid,false);
  const report=aggregateHistoricalMorning([storedRun,input],{minSamples:1,dropThresholdPct:2});
  assert.equal(report.sourceCoverage.received,2);
  assert.equal(report.sourceCoverage.rejected,1);
  assert.equal(report.sourceCoverage.structurallyValid,1);
  assert.equal(report.samples,1);
  assert.equal(report.sourceCoverage.independentlyAuthenticated,false);
});

test("complete morning bars are distinct from opening-drop cohort eligibility",()=>{
  const flatBars=bars.map((b,i)=>({...b,low:98,high:101}));
  const mild={...input,code:"1234",bars:flatBars};
  // The base fixture bottoms at 09:40, outside the 09:00–09:30 sharp-drop gate.
  const earlyDrop={...input,bars:bars.map((bar,i)=>({...bar,low:i===3?90:98}))};
  const stats=aggregateHistoricalMorning([earlyDrop,mild],{minSamples:1,dropThresholdPct:3});
  assert.equal(stats.sourceCoverage.received,2);
  assert.equal(stats.sourceCoverage.structurallyValid,2);
  assert.equal(stats.sourceCoverage.patternEligibleStockDays,1);
  assert.equal(stats.sourceCoverage.patternExcludedAfterAdapter.notSharpDrop,1);
  assert.equal(stats.sourceCoverage.readyForLiveUse,false);
  assert.equal(stats.samples,1);
});
