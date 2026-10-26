import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const source = readFileSync(new URL("../../lib/research/realTradeExecutionNotes.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(js, { exports });
const { validateExecutionNotes } = exports;
test("valid optional execution context", () => {
  assert.equal(validateExecutionNotes({ executedAtJst: "2026-10-26T14:19:28", limitPrice: 3635, reason: "仕事中は監視できないため利確", unableToMonitor: true }, "2026-10-26"), null);
});
test("rejects sale date mismatch, invalid clock and price", () => {
  const base = { executedAtJst: null, limitPrice: null, reason: null, unableToMonitor: false };
  assert.notEqual(validateExecutionNotes({ ...base, executedAtJst: "2026-10-25T14:19" }, "2026-10-26"), null);
  assert.notEqual(validateExecutionNotes({ ...base, executedAtJst: "2026-10-26T25:19" }, "2026-10-26"), null);
  assert.notEqual(validateExecutionNotes({ ...base, executedAtJst: "2026-02-30T14:19" }, "2026-02-30"), null);
  assert.notEqual(validateExecutionNotes({ ...base, limitPrice: -1 }, "2026-10-26"), null);
  assert.notEqual(validateExecutionNotes({ ...base, reason: "x".repeat(501) }, "2026-10-26"), null);
});
