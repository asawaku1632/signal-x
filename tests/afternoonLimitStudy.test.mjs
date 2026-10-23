import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAfternoonLimitStudy } from "../app/lib/research/afternoonLimitStudy.mjs";
const sample = {
  decisionAt: "2026-10-23T14:10:00+09:00",
  observedThrough: "2026-10-23T15:30:00+09:00",
  source: "SYNTHETIC_TEST_ONLY",
  quoteAtDecision: 3485, targetLimit: 3510,
  postDecisionHigh: 3510, postDecisionLow: 3470, sessionClose: 3485,
};
test("touching a limit does not assert a fill", () => {
  const r = evaluateAfternoonLimitStudy(sample);
  assert.equal(r.status, "OBSERVED");
  assert.equal(r.touched, true);
  assert.equal(r.fillStatus, "POSSIBLE_NOT_CONFIRMED");
});
test("untouched limit is not filled", () => {
  const r = evaluateAfternoonLimitStudy({...sample, postDecisionHigh:3509});
  assert.equal(r.touched, false);
  assert.equal(r.fillStatus, "NOT_TOUCHED");
});
test("data absent is unavailable", () => {
  assert.equal(evaluateAfternoonLimitStudy({}).status, "UNAVAILABLE");
});
test("later decision cannot use earlier outcome", () => {
  const r = evaluateAfternoonLimitStudy({...sample, decisionAt:"2026-10-23T15:31:00+09:00"});
  assert.equal(r.reason, "INVALID_TIME_ORDER");
});
test("missing source is unavailable", () => {
  const r = evaluateAfternoonLimitStudy({...sample, source:""});
  assert.equal(r.reason, "MISSING_PROVENANCE_OR_TIMESTAMPS");
});
test("invalid range is unavailable", () => {
  const r = evaluateAfternoonLimitStudy({...sample, postDecisionLow:3511});
  assert.equal(r.reason, "INCONSISTENT_POST_DECISION_RANGE");
});
