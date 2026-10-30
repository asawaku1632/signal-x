import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "app/lib/learning/patternForwardLearning.ts"), "utf8");
const statsStart = source.indexOf("export async function refreshPatternForwardStats");
const statsEnd = source.indexOf("function numberOrNull", statsStart);
assert.ok(statsStart >= 0, "refreshPatternForwardStats must exist");
assert.ok(statsEnd > statsStart, "stats query must have a valid end boundary");
const statsSql = source.slice(statsStart, statsEnd);

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
  const completedCodes = /COUNT\(DISTINCT code\) FILTER \(WHERE return_5d IS NOT NULL\) >= (?:30|15)/g;
  const gates = [...statsSql.matchAll(completedCodes)];
  assert.equal(gates.length, 4, "both status and reason branches must use completed codes");
  assert.equal(gates.filter((match) => match[0].endsWith("30")).length, 2);
  assert.equal(gates.filter((match) => match[0].endsWith("15")).length, 2);
  assert.doesNotMatch(statsSql, /COUNT\(DISTINCT code\) >= (?:30|15)/);
});

test("validation status and reason use matching completed-outcome gates", () => {
  const statusStart = statsSql.indexOf("END AS validation_status");
  const reasonEnd = statsSql.indexOf("END AS status_reason");
  assert.ok(statusStart > 0 && reasonEnd > statusStart);
  const statusBranch = statsSql.slice(0, statusStart);
  const reasonBranch = statsSql.slice(statusStart, reasonEnd);
  for (const threshold of [15, 8]) {
    const gate = "COUNT(DISTINCT trade_date) FILTER (WHERE return_5d IS NOT NULL) >= " + threshold;
    assert.equal(statusBranch.split(gate).length - 1, 1);
    assert.equal(reasonBranch.split(gate).length - 1, 1);
  }
  for (const threshold of [30, 15]) {
    const gate = "COUNT(DISTINCT code) FILTER (WHERE return_5d IS NOT NULL) >= " + threshold;
    assert.equal(statusBranch.split(gate).length - 1, 1);
    assert.equal(reasonBranch.split(gate).length - 1, 1);
  }
});
