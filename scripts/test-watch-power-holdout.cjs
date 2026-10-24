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
    row("2026-10-26", "B", 60, 2),
    row("2026-10-26", "C", 73, 1),
    row("2026-10-26", "D", 60, 100, "AVOID"),
  ]);
  assert.equal(result.datesObserved, 1);
  assert.equal(result.datesComparable, 1);
  assert.equal(result.byDate[0].differencePp, 1);
  assert.equal(result.readyForReview, false);
});

test("missing outcomes are not zero and block comparison", () => {
  const result = evaluateWatchPowerHoldout([
    row("2026-10-26", "A", 60, null),
    row("2026-10-26", "B", 75, 2),
  ]);
  assert.equal(result.datesComparable, 0);
  assert.equal(result.byDate[0].missingCount, 1);
  assert.equal(result.byDate[0].differencePp, null);
});

test("middle power band is excluded from the contrast", () => {
  const result = evaluateWatchPowerHoldout([
    row("2026-10-26", "A", 67.99, 3),
    row("2026-10-26", "B", 68, 100),
    row("2026-10-26", "C", 70.99, 100),
    row("2026-10-26", "D", 71, -1),
  ]);
  assert.equal(result.byDate[0].lowCount, 1);
  assert.equal(result.byDate[0].highCount, 1);
  assert.equal(result.byDate[0].differencePp, 4);
});

test("identical duplicates are counted only once", () => {
  const a = row("2026-10-26", "A", 60, 2);
  const result = evaluateWatchPowerHoldout([a, { ...a }, row("2026-10-26", "B", 72, 0)]);
  assert.equal(result.byDate[0].lowCount, 1);
  assert.equal(result.conflictingDuplicates, 0);
});

test("conflicting duplicates prevent review", () => {
  const result = evaluateWatchPowerHoldout([
    row("2026-10-26", "A", 60, 2),
    row("2026-10-26", "A", 60, 99),
    row("2026-10-26", "B", 72, 0),
  ]);
  assert.equal(result.conflictingDuplicates, 1);
  assert.equal(result.readyForReview, false);
});

test("reports date-equal-weight difference rather than pooled stock weight", () => {
  const result = evaluateWatchPowerHoldout([
    row("2026-10-26", "A", 60, 10), row("2026-10-26", "B", 72, 0),
    row("2026-10-27", "C", 60, 0), row("2026-10-27", "D", 72, 10),
    row("2026-10-27", "E", 72, 10),
  ]);
  assert.equal(result.meanDateDifferencePp, 0);
  assert.equal(result.lowOutperformedDates, 1);
  assert.equal(result.datesComparable, 2);
});

test("rejects invalid dates and non-finite numeric values", () => {
  const result = evaluateWatchPowerHoldout([
    row("not-a-date", "A", 60, 100),
    row("2026-10-26", "B", Number.NaN, 3),
    row("2026-10-26", "C", 72, Infinity),
  ]);
  assert.equal(result.datesObserved, 1);
  assert.equal(result.byDate[0].missingCount, 2);
  assert.equal(result.datesComparable, 0);
});

test("conflicting record stays quarantined even after a third duplicate", () => {
  const result = evaluateWatchPowerHoldout([
    row("2026-10-26", "A", 60, 2),
    row("2026-10-26", "A", 60, 99),
    row("2026-10-26", "A", 60, 2),
    row("2026-10-26", "B", 72, 0),
  ]);
  assert.equal(result.conflictingDuplicates, 1);
  assert.equal(result.byDate[0].lowCount, 0);
  assert.equal(result.datesComparable, 0);
  assert.equal(result.readyForReview, false);
});

test("production-shaped row conversion preserves missing 5d outcomes", () => {
  const ts = require("typescript");
  const fs = require("node:fs");
  const path = require("node:path");
  const Module = require("node:module");
  const filename = path.resolve(__dirname, "../app/lib/learning/watchPowerHoldoutAdapter.ts");
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const adapter = new Module(filename, module);
  adapter.filename = filename;
  adapter.paths = Module._nodeModulePaths(path.dirname(filename));
  adapter.require = function (name) {
    if (name === "./watchPowerHoldout") return { evaluateWatchPowerHoldout };
    return Module.prototype.require.call(this, name);
  };
  adapter._compile(output, filename);
  const sqlRows = [
    { code: "A", trade_date: "2026-10-26", decision_status: "WATCH", ai_power: "67", return_5d: null },
    { code: "B", trade_date: "2026-10-26", decision_status: "WATCH", ai_power: "72", return_5d: "2.5" },
    { code: "C", trade_date: "2026-10-26", decision_status: "AVOID", ai_power: "65", return_5d: "10" },
  ];
  const converted = adapter.exports.mapFrozenSwingRows(sqlRows);
  assert.equal(converted.length, 2);
  assert.equal(converted[0].return5dPct, null);
  assert.equal(converted[1].return5dPct, 2.5);
  const result = adapter.exports.evaluateFrozenSwingHoldout(sqlRows);
  assert.equal(result.datesComparable, 0);
  assert.equal(result.byDate[0].missingCount, 1);
  assert.equal(result.readyForReview, false);
});

test("October 19-23 cannot enter a hypothesis frozen on October 24", () => {
  const result = evaluateWatchPowerHoldout([
    row("2026-10-19", "A", 67, 99),
    row("2026-10-23", "B", 72, -99),
    row("2026-10-26", "C", 67, 1),
    row("2026-10-26", "D", 72, 0),
  ]);
  assert.equal(result.datesObserved, 1);
  assert.equal(result.byDate[0].date, "2026-10-26");
  assert.equal(result.byDate[0].differencePp, 1);
});

test("readiness remains collecting without ten comparable future dates", () => {
  const ts = require("typescript");
  const fs = require("node:fs");
  const path = require("node:path");
  const Module = require("node:module");
  const filename = path.resolve(__dirname, "../app/lib/learning/watchPowerHoldoutReadiness.ts");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = function (name) {
    if (name === "./watchPowerHoldout") return { evaluateWatchPowerHoldout };
    return Module.prototype.require.call(this, name);
  };
  mod._compile(output, filename);
  const report = mod.exports.getWatchPowerHoldoutReadiness([
    row("2026-10-26", "A", 67, 3),
    row("2026-10-26", "B", 72, 1),
    row("2026-10-27", "C", 67, null),
    row("2026-10-27", "D", 72, 2),
  ]);
  assert.equal(report.status, "COLLECTING");
  assert.equal(report.comparableDates, 1);
  assert.equal(report.remainingComparableDates, 9);
  assert.equal(report.datesWithMissingOutcomes, 1);
  assert.equal(report.dateEqualWeightDifferencePp, null);
});


test("ten independent comparable post-freeze dates unlock review", () => {
  const rows = [];
  for (let day = 26; day <= 30; day++) {
    const date = `2026-10-${day}`;
    rows.push(row(date, `L${day}`, 60, 2), row(date, `H${day}`, 75, 1));
  }
  for (let day = 2; day <= 6; day++) {
    const date = `2026-11-0${day}`;
    rows.push(row(date, `L${day}`, 60, 2), row(date, `H${day}`, 75, 1));
  }
  const result = evaluateWatchPowerHoldout(rows);
  assert.equal(result.datesComparable, 10);
  assert.equal(result.readyForReview, true);
  assert.equal(result.meanDateDifferencePp, 1);
});

test("conflicting duplicates block review even after ten comparable dates", () => {
  const rows = [];
  for (let day = 1; day <= 10; day++) {
    const date = `2026-11-${String(day).padStart(2, "0")}`;
    rows.push(row(date, `L${day}`, 60, 2), row(date, `H${day}`, 75, 1));
  }
  rows.push(row("2026-11-01", "L1", 60, 99));
  const result = evaluateWatchPowerHoldout(rows);
  assert.equal(result.conflictingDuplicates, 1);
  assert.equal(result.readyForReview, false);
});

test("actual WATCH score bands", () => {
 const result = evaluateWatchPowerHoldout([row("2026-10-26","A",65,3),row("2026-10-26","B",67,1),row("2026-10-26","C",68,99),row("2026-10-26","D",70,99),row("2026-10-26","E",71,0),row("2026-10-26","F",74,2)]);
 assert.equal(result.byDate[0].lowCount,2);
 assert.equal(result.byDate[0].highCount,2);
 assert.equal(result.byDate[0].differencePp,1);
});
