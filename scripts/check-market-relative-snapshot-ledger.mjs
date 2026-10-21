import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const load = (path, requireFn) => {
  const source = fs.readFileSync(path, "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: requireFn, Map, Object, Number, Date });
  return exports;
};
const validator = load("app/lib/research/marketRelativeProspectiveSnapshot.ts");
const ledgerModule = load("app/lib/research/marketRelativeSnapshotLedger.ts", () => validator);
const base = {
  signalId: "signal-1", code: "9684", aiPower: 93, price: 3000,
  priceObservedAt: "2026-10-21T09:05:00+09:00",
  signalObservedAt: "2026-10-21T09:05:10+09:00",
  capturedAt: "2026-10-21T09:05:15+09:00",
  source: "verified-provider", version: "shadow-v1"
};
const ledger = ledgerModule.createSnapshotLedger();
let checks = 0;
const test = (condition) => { assert.ok(condition); checks++; };
test(ledger.count() === 0);
test(ledger.write(base).status === "inserted");
test(ledger.count() === 1);
test(ledger.write({ ...base }).status === "duplicate");
test(ledger.count() === 1);
test(ledger.write({ ...base, aiPower: 10 }).status === "conflict");
test(ledger.get("signal-1").aiPower === 93);
test(Object.isFrozen(ledger.get("signal-1")));
test(ledger.write({ ...base, signalId: "bad", code: "DEV" }).status === "rejected");
test(ledger.write({ ...base, signalId: "signal-2" }).status === "inserted");
test(ledger.count() === 2);
console.log("PASS: " + checks + " prospective snapshot ledger checks");
