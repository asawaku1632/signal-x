import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
function load(path, requireFn = () => { throw Error("Unexpected import"); }) {
  const src = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, require: requireFn, Date, Number, String, Set });
  return module.exports;
}
const gate = load("../app/lib/research/marketRelativeEvidenceGate.ts");
const report = load("../app/lib/research/marketRelativeEvidenceReport.ts", () => gate);
const { scoreEligibleEvidence } = load("../app/lib/research/marketRelativeEvidenceScoring.ts", () => report);
const row = { signalId: "s1", stockCode: "3762", frozenAiPower: 95, signalObservedAt: "2026-10-20T00:00:00Z", entryPrice: 100, exitPrice: 110, entryObservedAt: "2026-10-20T00:05:00Z", exitObservedAt: "2026-10-21T00:05:00Z", benchmark: "nikkei", benchmarkEntryPrice: 40000, benchmarkExitPrice: 40400, benchmarkEntryObservedAt: "2026-10-20T00:05:00Z", benchmarkExitObservedAt: "2026-10-21T00:05:00Z", horizonTradingDays: 1, window: "intraday_0905" };
const result = scoreEligibleEvidence([row, { ...row, signalId: "s2", frozenAiPower: null }]);
assert.equal(result.total, 2);
assert.equal(result.eligibleCount, 1);
assert.equal(result.excludedCount, 1);
assert.equal(result.scored.length, 1);
assert.ok(Math.abs(result.scored[0].stockReturnPct - 10) < 1e-8);
assert.ok(Math.abs(result.scored[0].marketReturnPct - 1) < 1e-8);
assert.ok(Math.abs(result.scored[0].excessReturnPoints - 9) < 1e-8);
assert.equal(result.scored[0].aiPowerAtSignal, 95);
assert.equal(scoreEligibleEvidence([]).scored.length, 0);
console.log("PASS: 9 eligible evidence scoring checks");
