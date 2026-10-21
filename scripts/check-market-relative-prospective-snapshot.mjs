import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("app/lib/research/marketRelativeProspectiveSnapshot.ts", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
vm.runInNewContext(code, { exports, Number, Date });
const check = exports.validateProspectiveSnapshot;
const valid = {
  signalId: "signal-1", code: "9684", aiPower: 93, price: 3000,
  priceObservedAt: "2026-10-21T09:05:00+09:00",
  signalObservedAt: "2026-10-21T09:05:10+09:00",
  capturedAt: "2026-10-21T09:05:15+09:00",
  source: "verified-provider", version: "shadow-v1"
};
const cases = [
  [valid, null],
  [{...valid, code: "__DEV__"}, "identity"],
  [{...valid, aiPower: 101}, "ai_power"],
  [{...valid, price: 0}, "price"],
  [{...valid, version: ""}, "provenance"],
  [{...valid, capturedAt: "2026-10-21"}, "timestamp"],
  [{...valid, priceObservedAt: "2026-10-21T09:06:00+09:00"}, "time_order"],
  [{...valid, priceObservedAt: "2026-10-21T08:30:00+09:00"}, "stale_price"],
  [{...valid, capturedAt: "2026-10-21T09:07:00+09:00"}, "late_capture"]
];
for (const [row, expected] of cases) {
  const errors = check(row);
  if (expected === null) assert.equal(errors.length, 0);
  else assert.ok(errors.includes(expected), expected);
}
console.log("PASS: 9 prospective snapshot validation checks");
