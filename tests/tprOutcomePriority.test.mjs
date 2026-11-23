import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/cron/save-post/route.ts", import.meta.url), "utf8");
const patternStart = route.indexOf('case "pattern":');
const patternEnd = route.indexOf('case "reversal":', patternStart);
assert.ok(patternStart >= 0 && patternEnd > patternStart);
const pattern = route.slice(patternStart, patternEnd);

test("TPR outcomes are settled before expensive pattern scans", () => {
  const tpr = pattern.indexOf('label: "trend-reversal-outcomes"');
  const patternOutcomes = pattern.indexOf('label: "pattern-outcomes"');
  const patternStats = pattern.indexOf('label: "pattern-stats"');
  assert.ok(tpr >= 0 && patternOutcomes > tpr && patternStats > tpr);
});
test("TPR observations remain in the pattern phase", () => {
  assert.match(pattern, /label: "trend-reversal-observations"/);
});
