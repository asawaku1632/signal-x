/* Run with: node --test scripts/test-watch-power-holdout.cjs
 * Uses the project's existing typescript dev dependency; no new packages.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

function loadTs(relativePath) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
    reportDiagnostics: true,
  });
  const errors = (js.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, "TypeScript transpilation diagnostics");
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  compiled._compile(js.outputText, filename);
  return compiled.exports;
}
const { evaluateWatchPowerHoldout } = loadTs("app/lib/learning/watchPowerHoldout.ts");
const row = (date, code, power, outcome, status = "WATCH") => ({
  signalDate: date, code, aiPowerAtSignal: power, return5dPct: outcome, status,
});

test("excludes all discovery dates and non-WATCH labels", () => {
  const result = evaluateWatchPowerHoldout([
    row("2026-10-16", "A", 60, 100),
    row("2026-10-19", "B", 60, 2),
    row("2026-10-19", "C", 73, 1),
    row("2026-10-19", "D", 60, 100, "AVOID"),
  ]);
  assert.equal(result.datesObserved, 1);
  assert.equal(result.datesComparable, 1);
  assert.equal(result.byDate[0].differencePp, 1);
  assert.equal(result.readyForReview, false);
});

test("missing outcomes are not zero and block comparison", () => {
  const result = evaluateWatchPowerHoldout([
    row("2026-10-19", "A", 60, null),
    row("2026-10-19", "B", 75, 2),
  ]);
  assert.equal(result.datesComparable, 0);
  assert.equal(result.byDate[0].missingCount, 1);
  assert.equal(result.byDate[0].differencePp, null);
});

test("middle power band is excluded from the contrast", () => {
  const result = evaluateWatchPowerHoldout([
    row("2026-10-19", "A", 67.99, 3),
    row("2026-10-19", "B", 68, 100),
    row("2026-10-19", "C", 70.99, 100),
    row("2026-10-19", "D", 71, -1),
  ]);
  assert.equal(result.byDate[0].lowCount, 1);
  assert.equal(result.byDate[0].highCount, 1);
  assert.equal(result.byDate[0].differencePp, 4);
});

test("identical duplicates are counted only once", () => {
  const a = row("2026-10-19", "A", 60, 2);
  const result = evaluateWatchPowerHoldout([a, { ...a }, row("2026-10-19", "B", 72, 0)]);
  assert.equal(result.byDate[0].lowCount, 1);
  assert.equal(result.conflictingDuplicates, 0);
});

test("conflicting duplicates prevent review", () => {
  const result = evaluateWatchPowerHoldout([
    row("2026-10-19", "A", 60, 2),
    row("2026-10-19", "A", 60, 99),
    row("2026-10-19", "B", 72, 0),
  ]);
  assert.equal(result.conflictingDuplicates, 1);
  assert.equal(result.readyForReview, false);
});

test("reports date-equal-weight difference rather than pooled stock weight", () => {
  const result = evaluateWatchPowerHoldout([
    row("2026-10-19", "A", 60, 10), row("2026-10-19", "B", 72, 0),
    row("2026-10-20", "C", 60, 0), row("2026-10-20", "D", 72, 10),
    row("2026-10-20", "E", 72, 10),
  ]);
  assert.equal(result.meanDateDifferencePp, 0);
  assert.equal(result.lowOutperformedDates, 1);
  assert.equal(result.datesComparable, 2);
});

test("rejects invalid dates and non-finite numeric values", () => {
  const result = evaluateWatchPowerHoldout([
    row("not-a-date", "A", 60, 100),
    row("2026-10-19", "B", Number.NaN, 3),
    row("2026-10-19", "C", 72, Infinity),
  ]);
  assert.equal(result.datesObserved, 1);
  assert.equal(result.byDate[0].missingCount, 2);
  assert.equal(result.datesComparable, 0);
});
