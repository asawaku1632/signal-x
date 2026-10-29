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
test("structurally plausible five-minute exports still need independent proof",()=>{
  const row=classify({timeframe:"5m",bars:Array.from({length:30},()=>({})),
    timestampSemantics:"BAR_START",exchangeTimezone:"Asia/Tokyo",
    licenseVerified:true,source:"TEST"});
  assert.equal(row.morningOutcomeCandidate,true);
  assert.equal(row.requiresIndependentSourceProof,true);
  assert.equal(row.readyForTrading,false);
});
test("unknown summaries are never eligible",()=>{
  assert.equal(classify({timeframe:"1h"}).morningOutcomeCandidate,false);
  assert.equal(classify(null).dailyIndicatorCandidate,false);
});
