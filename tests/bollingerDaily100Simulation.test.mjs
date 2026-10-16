import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
const source = readFileSync(join(process.cwd(), "app/lib/research/bollingerDaily100Simulation.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function("exports", js)(exports);
const { simulateDaily100Partition } = exports;
const codes = Array.from({ length: 20 }, (_, i) => String(3000 + i));
test("3 failed codes do not prevent 17 successful codes", async () => {
  const visited = [];
  const result = await simulateDaily100Partition(0, codes, async code => {
    visited.push(code);
    if (["3002", "3009", "3018"].includes(code)) throw Error("simulated vendor failure");
    return { close: 100 };
  });
  assert.equal(visited.length, 20);
  assert.deepEqual([result.status, result.observed, result.failed], ["PARTIAL", 17, 3]);
  assert.equal(result.checks.filter(x => x.state === "SOURCE_FAILED").length, 3);
});
test("all 20 successful => COMPLETE", async () => {
  const result = await simulateDaily100Partition(1, codes, async () => ({ close: 100 }));
  assert.deepEqual([result.status, result.observed, result.failed], ["COMPLETE", 20, 0]);
});
test("all 20 fail => FAILED, still visits all", async () => {
  let attempts = 0;
  const result = await simulateDaily100Partition(2, codes, async () => { attempts++; throw Error("offline"); });
  assert.deepEqual([result.status, result.observed, result.failed, attempts], ["FAILED", 0, 20, 20]);
});
test("invalid partition input rejected", async () => {
  await assert.rejects(simulateDaily100Partition(5, codes, async () => true), /INPUT_INVALID/);
});
