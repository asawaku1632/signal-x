import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const source = readFileSync(new URL("../app/lib/research/bollingerDaily100Plan.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("module", "exports", js)(module, module.exports);
const { buildDaily100Partitions, validateDaily100RequestBudget, daily100ClaimKey } = module.exports;
const codes = Array.from({ length: 100 }, (_, i) => String(1000 + i));

test("exactly five disjoint partitions, preserving original order", () => {
  const groups = buildDaily100Partitions(codes);
  assert.equal(groups.length, 5);
  assert.deepEqual(groups.map(g => g.codes.length), [20, 20, 20, 20, 20]);
  assert.deepEqual(groups.flatMap(g => g.codes), codes);
  assert.deepEqual(groups.map(g => g.partitionId), [0, 1, 2, 3, 4]);
});
test("invalid universe fails closed", () => {
  assert.throws(() => buildDaily100Partitions(codes.slice(1)), /UNIVERSE_INVALID/);
  assert.throws(() => buildDaily100Partitions([...codes.slice(0, 99), codes[0]]), /UNIVERSE_INVALID/);
  assert.throws(() => buildDaily100Partitions([...codes.slice(0, 99), "BAD"]), /UNIVERSE_INVALID/);
});
test("partition request budgets are bounded", () => {
  assert.equal(validateDaily100RequestBudget(20, 10), 30);
  for (const args of [[21, 0], [20, 11], [-1, 0], [20.5, 0], [20, 0, -1]]) {
    assert.throws(() => validateDaily100RequestBudget(...args), /BUDGET_EXCEEDED/);
  }
});
test("claim identity is stable and partition-specific", () => {
  const a = daily100ClaimKey("2026-10-19", 0, "BB_DAILY_100_V1");
  assert.equal(a, daily100ClaimKey("2026-10-19", 0, "BB_DAILY_100_V1"));
  assert.notEqual(a, daily100ClaimKey("2026-10-19", 1, "BB_DAILY_100_V1"));
  assert.throws(() => daily100ClaimKey("2026-10-19", 5, "BB_DAILY_100_V1"), /CLAIM_INVALID/);
});
