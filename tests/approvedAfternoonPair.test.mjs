import test from "node:test";
import assert from "node:assert/strict";
import {evaluateApprovedAfternoonObservationPair as run} from "../app/lib/research/approvedAfternoonPair.mjs";
const base={code:"3762",tradingDate:"2026-10-23",source:"SYNTHETIC_TEST_ONLY",licenseStatus:"APPROVED",phase:"AFTERNOON"};
const decision={...base,capturedAt:"2026-10-23T14:10:01+09:00",observedAt:"2026-10-23T14:10:00+09:00",quotePrice:3485};
const outcome={...base,capturedAt:"2026-10-23T15:30:01+09:00",observedAt:"2026-10-23T15:30:00+09:00",quotePrice:3485};
test("two snapshots do not establish a high, fill or touch",()=>{
  const r=run({decision,outcome,targetLimit:3510});
  assert.equal(r.status,"OBSERVED_PAIR_ONLY");
  assert.equal(r.limitStudyStatus,"UNAVAILABLE");
  assert.equal(r.executionStatus,"NOT_EVALUATED");
});
test("unapproved source fails closed",()=>assert.equal(run({decision:{...decision,licenseStatus:"UNKNOWN"},outcome}).status,"UNAVAILABLE"));
test("different ticker fails closed",()=>assert.equal(run({decision,outcome:{...outcome,code:"9684"}}).reason,"DIFFERENT_SECURITY_OR_DAY"));
test("outcome must follow decision",()=>assert.equal(run({decision,outcome:{...outcome,observedAt:decision.observedAt}}).reason,"OUTCOME_NOT_AFTER_DECISION"));
test("mixed sources fail closed",()=>assert.equal(run({decision,outcome:{...outcome,source:"OTHER_APPROVED"}}).reason,"MIXED_PROVIDER"));
