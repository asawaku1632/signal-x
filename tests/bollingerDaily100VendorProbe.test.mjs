import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync("app/lib/research/bollingerDaily100VendorProbe.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function("exports", js)(exports);
const { probeDaily100Vendor } = exports;

test("five-code cap blocks accidental hundred-code fetch", async () => {
  let called = 0;
  await assert.rejects(probeDaily100Vendor(Array.from({length:100},(_,i)=>String(3000+i)), async () => { called++; }), /BUDGET_INVALID/);
  assert.equal(called, 0);
});
test("partial source failures counted without aborting remaining codes", async () => {
  const seen = [];
  const result = await probeDaily100Vendor(["3000","3001","3002"], async code => {
    seen.push(code);
    if (code === "3001") throw Error("simulated");
    return { close: 100 };
  });
  assert.deepEqual([result.requested,result.succeeded,result.failed], [3,2,1]);
  assert.deepEqual(seen, ["3000","3001","3002"]);
});
test("timeouts do not block later codes", async () => {
  const result = await probeDaily100Vendor(["3000","3001"], async code =>
    code === "3000" ? new Promise(() => {}) : { close: 100 }, { timeoutMs: 5 });
  assert.deepEqual([result.succeeded,result.failed], [1,1]);
  assert.equal(result.checks[0].error, "SOURCE_TIMEOUT");
});
test("invalid duplicate codes rejected before vendor access", async () => {
  await assert.rejects(probeDaily100Vendor(["3000","3000"], async () => true), /BUDGET_INVALID/);
});
