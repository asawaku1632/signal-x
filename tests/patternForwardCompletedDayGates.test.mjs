import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "app/lib/learning/patternForwardLearning.ts"), "utf8");
const statsSql = source.slice(source.indexOf("export async function refreshPatternForwardStats"), source.indexOf("function numberOrNull"));

test("PROMISING and VALIDATED day gates require completed five-day outcomes", () => {
  const completedGate = /COUNT\(DISTINCT trade_date\) FILTER \(WHERE return_5d IS NOT NULL\) >= (?:15|8)/g;
  const gates = [...statsSql.matchAll(completedGate)];
  assert.equal(gates.length, 4, "both status and reason branches must use completed dates");
  assert.equal(gates.filter((match) => match[0].endsWith("15")).length, 2);
  assert.equal(gates.filter((match) => match[0].endsWith("8")).length, 2);
  assert.doesNotMatch(statsSql, /COUNT\(DISTINCT trade_date\) >= (?:15|8)/);
});

test("minimum completed outcome sample gates remain intact", () => {
  assert.equal([...statsSql.matchAll(/COUNT\(return_5d\) >= 50/g)].length, 2);
  assert.equal([...statsSql.matchAll(/COUNT\(return_5d\) >= 20/g)].length, 2);
});

test("PROMISING and VALIDATED code gates require completed five-day outcomes", () => {
  const completedCodes = /COUNT\\(DISTINCT code\\) FILTER \\(WHERE return_5d IS NOT NULL\\) >= (?:30|15)/g;
  const gates = [...statsSql.matchAll(completedCodes)];
  assert.equal(gates.length, 4, "both status and reason branches must use completed codes");
  assert.equal(gates.filter((match) => match[0].endsWith("30")).length, 2);
  assert.equal(gates.filter((match) => match[0].endsWith("15")).length, 2);
  assert.doesNotMatch(statsSql, /COUNT\\(DISTINCT code\\) >= (?:30|15)/);
});
