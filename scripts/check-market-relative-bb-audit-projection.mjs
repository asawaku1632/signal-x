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
const projection = load("../app/lib/research/marketRelativeBbAuditProjection.ts");
const gate = load("../app/lib/research/marketRelativeEvidenceGate.ts");
const report = load("../app/lib/research/marketRelativeEvidenceReport.ts", () => gate);
const row = projection.projectBbAuditRow({ id: 1, code: "3762", signal_date: "2026-08-10", entry_price: "1234", display_ai_power_after_bb: "92" });
assert.equal(row.signalId, "bb:1:2026-08-10");
assert.equal(row.frozenAiPower, 92);
assert.equal(row.entryPrice, 1234);
assert.equal(row.signalObservedAt, null);
assert.equal(row.exitPrice, null);
assert.equal(row.benchmarkEntryPrice, null);
assert.equal(gate.validateHistoricalEvidence(row).status, "excluded");
assert.equal(report.buildEvidenceReport([row]).eligibleCount, 0);
assert.equal(projection.projectBbAuditRow({ id: 2, code: "3762", signal_date: "2026-08-10", entry_price: "", display_ai_power_after_bb: null }).entryPrice, null);
console.log("PASS: 9 BB audit projection checks");
