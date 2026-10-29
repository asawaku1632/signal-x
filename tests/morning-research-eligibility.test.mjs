import test from "node:test";
import assert from "node:assert/strict";
import {classifyMorningResearchEvidence as classify} from "../app/lib/research/morningResearchEligibility.mjs";

test("daily technical snapshots cannot become intraday morning outcomes",()=>{
  const row=classify({timeframe:"1D",close:100,bar_end_at:"2026-10-28T15:30:00+09:00"});
  assert.equal(row.kind,"DAILY_TECHNICAL_SNAPSHOT");
  assert.equal(row.dailyIndicatorCandidate,true);
  assert.equal(row.morningOutcomeCandidate,false);
  assert.equal(row.readyForTrading,false);
  assert.equal(row.requiresIndependentSourceProof,true);
});
test("incomplete five-minute exports are excluded from morning outcomes",()=>{
  const row=classify({timeframe:"5m",bars:[{}],timestampSemantics:"BAR_START",
    exchangeTimezone:"Asia/Tokyo",licenseVerified:true,source:"TEST"});
  assert.equal(row.morningOutcomeCandidate,false);
  assert.deepEqual(row.reasons,["MISSING_COMPLETE_MORNING_BARS"]);
});
test("thirty empty candles are not valid five-minute outcomes",()=>{
  const row=classify({timeframe:"5m",bars:Array.from({length:30},()=>({})),
    timestampSemantics:"BAR_START",exchangeTimezone:"Asia/Tokyo",
    licenseVerified:true,source:"TEST"});
  assert.equal(row.morningOutcomeCandidate,false);
  assert.ok(row.reasons.length>0);
  assert.equal(row.requiresIndependentSourceProof,true);
  assert.equal(row.readyForTrading,false);
});
test("unknown summaries are never eligible",()=>{
  assert.equal(classify({timeframe:"1h"}).morningOutcomeCandidate,false);
  assert.equal(classify(null).dailyIndicatorCandidate,false);
});

test("complete valid five-minute bars are only research candidates",()=>{
  const bars=Array.from({length:30},(_,i)=>({
    time:Date.parse("2026-10-28T09:00:00+09:00")/1000+i*300,
    open:100,high:i>3?104:101,low:i===3?90:98,close:100
  }));
  const row=classify({timeframe:"5m",code:"590A",tradeDate:"2026-10-28",
    previousClose:100,bars,timestampSemantics:"BAR_START",
    exchangeTimezone:"Asia/Tokyo",licenseVerified:true,source:"TEST_FIXTURE"});
  assert.equal(row.morningOutcomeCandidate,true);
  assert.equal(row.readyForTrading,false);
  assert.equal(row.requiresIndependentSourceProof,true);
});
