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
const { buildEvidenceReport } = load("../app/lib/research/marketRelativeEvidenceReport.ts", () => gate);
const row = { signalId: "s1", stockCode: "3762", frozenAiPower: 95, signalObservedAt: "2026-10-20T00:00:00Z", entryPrice: 100, exitPrice: 110, entryObservedAt: "2026-10-20T00:05:00Z", exitObservedAt: "2026-10-21T00:05:00Z", benchmark: "nikkei", benchmarkEntryPrice: 40000, benchmarkExitPrice: 40100, benchmarkEntryObservedAt: "2026-10-20T00:05:00Z", benchmarkExitObservedAt: "2026-10-21T00:05:00Z", horizonTradingDays: 1, window: "intraday_0905" };
const report = buildEvidenceReport([row, row, { ...row, signalId: "s2", frozenAiPower: null }, { ...row, signalId: "s3", horizonTradingDays: 0 }]);
assert.equal(report.total, 4);
assert.equal(report.eligibleCount, 1);
assert.equal(report.excludedCount, 3);
assert.equal(report.reasonCounts.duplicate_signal, 1);
assert.equal(report.reasonCounts.missing_frozen_ai_power, 1);
assert.equal(report.reasonCounts.invalid_horizon, 1);
assert.equal(report.exclusions.length, 3);
assert.equal(buildEvidenceReport([]).eligibleCount, 0);
assert.equal(buildEvidenceReport([{ ...row, window: "bad" }]).reasonCounts.invalid_window, 1);
console.log("PASS: 9 evidence accounting checks");
