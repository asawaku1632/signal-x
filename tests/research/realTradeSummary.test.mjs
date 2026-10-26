import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync(new URL("../../lib/research/realTradeSummary.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(js, { exports });
const { summarizeRealizedResults } = exports;

test("no trades have unavailable win rate and expectancy", () => {
  const stats = summarizeRealizedResults([]);
  assert.equal(stats.winRate, null);
  assert.equal(stats.expectancy, null);
  assert.equal(stats.insufficientSample, true);
});

test("profits and drawdown reflect realized execution order", () => {
  const stats = summarizeRealizedResults([10200, -5000, 0, -4000, 8000].map(profitYen => ({ profitYen })));
  assert.equal(stats.total, 9200);
  assert.equal(stats.winRate, 40);
  assert.equal(stats.averageWin, 9100);
  assert.equal(stats.averageLoss, -4500);
  assert.equal(stats.expectancy, 1840);
  assert.equal(stats.maxDrawdown, 9000);
});

test("non-finite values are rejected", () => {
  assert.throws(() => summarizeRealizedResults([{ profitYen: NaN }]));
});
