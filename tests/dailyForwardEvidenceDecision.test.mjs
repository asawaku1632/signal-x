import test from "node:test";
import assert from "node:assert/strict";
import { classifyForwardResearchEvidence } from "../app/lib/research/dailyForwardEvidenceDecision.mjs";
const period=(positiveRate,averageReturnPct)=>({n:40,distinctCodes:15,distinctDates:15,positiveRate,averageReturnPct});
const record=(a,b,status="DESCRIPTIVE_HOLDOUT_ONLY")=>({horizon:10,band:"20-39",historical:a,future:b,status});
const classify=(r)=>classifyForwardResearchEvidence([r])[0];

test("replicated positive descriptive trend is review candidate only",()=>{
  const r=classify(record(period(0.65,2),period(0.6,1)));
  assert.equal(r.decision,"IMPROVEMENT_CANDIDATE");
  assert.equal(r.autoApply,false);
  assert.equal(r.reviewRequired,true);
});
test("disagreeing periods remain on hold",()=>{
  assert.equal(classify(record(period(0.65,2),period(0.4,-1))).decision,"HOLD");
});
test("both periods failing criteria are not adopted",()=>{
  assert.equal(classify(record(period(0.4,-1),period(0.45,-2))).decision,"NOT_ADOPTED");
});
test("thin or unverified periods cannot become candidates",()=>{
  const thin={...period(0.9,20),distinctCodes:1};
  assert.equal(classify(record(thin,period(0.9,20))).decision,"HOLD");
  assert.equal(classify(record(period(0.9,20),period(0.9,20),"INSUFFICIENT_PERIOD_COVERAGE")).decision,"HOLD");
});
