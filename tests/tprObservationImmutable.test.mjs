import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/lib/learning/trendPullbackReversal.ts", import.meta.url), "utf8");
const saveFunction = source.split("export async function updateTrendPullbackReversalOutcomes")[0];

test("TPR observation cron reruns do not overwrite the initial signal", () => {
  assert.match(saveFunction, /ON CONFLICT\s*\(trade_date,code\)\s*DO NOTHING/i);
  assert.doesNotMatch(saveFunction, /ON CONFLICT\s*\(trade_date,code\)\s*DO UPDATE/i);
});

test("TPR forward outcomes remain in their separate update path", () => {
  assert.match(source, /export async function updateTrendPullbackReversalOutcomes/);
});
