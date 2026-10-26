import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

const root = new URL("../", import.meta.url);
const runner = readFileSync(new URL("app/lib/research/morningFinalCheckRunner.ts", root), "utf8");
const adapter = readFileSync(new URL("app/lib/research/morningQuoteDiagnosticAdapter.ts", root), "utf8");

test("runner calls metadata adapter on an existing response", () => {
  assert.match(runner, /diagnoseExistingMorningResponse\(payload,response\.status,/);
  assert.match(runner, /const payload=await response\.json\(\)/);
});

test("adapter only delegates to the pure classifier", () => {
  assert.match(adapter, /return classifyFiveMinuteMetadata\(payload, status, tradeDate\)/);
  assert.doesNotMatch(adapter, /\bfetch\s*\(|\bpool\.|\bconsole\.|\bprocess\.env\b/);
});

test("runner preserves original morning decision and one-time claim", () => {
  assert.match(runner, /decideAtNineOhFive\(c,bars,date,new Date\(\)\)/);
  assert.match(runner, /morning_state='PENDING'/);
  assert.match(runner, /if\(!claim\.rowCount\)/);
});

test("diagnostic result is not yet persisted or used for trading decisions", () => {
  assert.match(runner, /void diagnostic;/);
  assert.doesNotMatch(runner, /quoteDiagnostic\s*:/);
});
