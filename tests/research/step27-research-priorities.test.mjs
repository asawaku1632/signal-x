import test from "node:test";
import assert from "node:assert/strict";
import { prioritizeMarketIndexResearch } from "../../app/lib/step27-research-priorities.mjs";
test("licensing is always the first blocker", () => {
  const result = prioritizeMarketIndexResearch({ state: "INSUFFICIENT_EVIDENCE" });
  assert.equal(result.recommendedFirst, "LICENSE");
  assert.equal(result.tasks[0].priority, 1);
  assert.equal(result.tasks[0].status, "BLOCKED_EXTERNAL_EVIDENCE");
});
test("insufficient audit evidence does not suggest repeated saves", () => {
  const result = prioritizeMarketIndexResearch({ state: "INSUFFICIENT_EVIDENCE" });
  assert.match(result.tasks[4].action, /再保存しない/);
  assert.equal(result.status, "RESEARCH_ONLY");
});
test("priorities do not grant market-data approval", () => {
  const result = prioritizeMarketIndexResearch({ state: "CONTINUE_MONITORING" });
  assert.equal(result.tasks[3].status, "BLOCKED_BY_LICENSE");
  assert.equal(result.tasks[4].status, "MONITOR");
});
