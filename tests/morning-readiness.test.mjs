import test from "node:test";
import assert from "node:assert/strict";
import {assessMorningResearchReadiness} from "../app/lib/research/morningReadiness.mjs";
const inventory=(overrides={})=>({
  priorFeatureRows:0,fiveMinuteBarStockDays:0,
  provenanceVerifiedStockDays:0,joinedStockDays:0,
  forwardEvaluatedStockDays:0,...overrides
});
test("empty inventory cannot claim readiness or enable signals",()=>{
  const report=assessMorningResearchReadiness(inventory());
  assert.equal(report.researchReplayPossible,false);
  assert.equal(report.readyForTrading,false);
  assert.equal(report.signalEnabled,false);
  assert.equal(report.blockers.length,5);
});
test("technical snapshots do not count as verified intraday bars",()=>{
  const report=assessMorningResearchReadiness(inventory({priorFeatureRows:6}));
  assert.equal(report.counts.fiveMinuteBarStockDays,0);
  assert.ok(report.blockers.includes("NO_COMPLETE_FIVE_MINUTE_STOCK_DAYS"));
});
test("verified joined observations permit offline replay but not trading",()=>{
  const report=assessMorningResearchReadiness(inventory({
    priorFeatureRows:100,fiveMinuteBarStockDays:60,
    provenanceVerifiedStockDays:50,joinedStockDays:40,forwardEvaluatedStockDays:25
  }));
  assert.equal(report.researchReplayPossible,true);
  assert.equal(report.blockers.length,0);
  assert.equal(report.readyForTrading,false);
  assert.equal(report.signalEnabled,false);
});
test("inconsistent or fabricated counts fail closed",()=>{
  for(const input of [
    inventory({priorFeatureRows:-1}),
    inventory({priorFeatureRows:1.5}),
    inventory({fiveMinuteBarStockDays:1,provenanceVerifiedStockDays:2}),
    inventory({priorFeatureRows:1,fiveMinuteBarStockDays:1,provenanceVerifiedStockDays:1,joinedStockDays:2}),
    inventory({priorFeatureRows:1,fiveMinuteBarStockDays:1,provenanceVerifiedStockDays:1,joinedStockDays:1,forwardEvaluatedStockDays:2})
  ])assert.throws(()=>assessMorningResearchReadiness(input));
});
