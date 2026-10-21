/** Offline fixture checks: no network, no database, no production writes. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependency) {
  const js = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: dependency, Date, Intl, Number, Array });
  return exports;
}
const contract = load("app/lib/research/marketIndexShadowContract.ts", () => {
  throw new Error("Unexpected dependency");
});
const { parseNikkeiChartSnapshot: parse } = load(
  "app/lib/research/marketIndexYahooChartParser.ts",
  name => {
    assert.ok(name.includes("marketIndexShadowContract"));
    return contract;
  },
);
const capturedAt = "2026-10-21T09:06:00+09:00";
const timestamp = Date.parse("2026-10-21T09:05:00+09:00") / 1000;
const payload = (symbol = "^N225", close = 39000, time = timestamp) => ({
  chart: { result: [{ meta: { symbol }, timestamp: [time],
    indicators: { quote: [{ close: [close] }] } }] },
});
assert.equal(parse({ payload: payload(), capturedAt }).status, "observed");
assert.equal(parse({ payload: payload("^TOPX"), capturedAt }).status, "invalid");
assert.equal(parse({ payload: payload("^N225", null), capturedAt }).status, "missing");
assert.equal(parse({ payload: payload("^N225", 39000, timestamp - 3600), capturedAt }).status, "stale");
assert.equal(parse({ payload: payload("^N225", 39000, timestamp + 3600), capturedAt }).status, "future_timestamp");
assert.equal(parse({ payload: { chart: { result: [] } }, capturedAt }).status, "invalid");
assert.equal(parse({ payload: null, capturedAt }).status, "invalid");
const incomplete = payload();
incomplete.chart.result[0].timestamp.push(timestamp + 60);
assert.equal(parse({ payload: incomplete, capturedAt }).status, "invalid");
console.log("PASS: 8 offline Nikkei chart parser checks (no live writes)");
