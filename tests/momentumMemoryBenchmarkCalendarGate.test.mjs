import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/lib/learning/momentumMemory.ts", import.meta.url), "utf8");
const start = source.indexOf("export async function updateMomentumMemoryBenchmarks(");
const end = source.indexOf("export async function refreshMomentumMemoryForwardStats()", start);
const implementation = source.slice(start, end);

test("MM benchmark stays fail-closed without independently verified exchange sessions", () => {
  assert.ok(start >= 0 && end > start);
  assert.match(implementation, /momentumMemoryBenchmarksUpdated:\s*0/);
  assert.doesNotMatch(implementation, /pool\.query|UPDATE\s+momentum_memory_observations|fifth_session/i);
});

test("benchmark remains explicitly blocked until calendar and matching outcome horizons are verified", () => {
  assert.match(implementation, /verified TSE calendar/i);
  assert.match(implementation, /matching stock-outcome horizons/i);
});

const outcomeStart = source.indexOf("export async function updateMomentumMemoryOutcomes(");
const outcomeEnd = source.indexOf("export async function updateMomentumMemoryBenchmarks(", outcomeStart);
const outcomeImplementation = source.slice(outcomeStart, outcomeEnd);

test("MM forward outcomes stay fail-closed without verified exchange sessions", () => {
  assert.ok(outcomeStart >= 0 && outcomeEnd > outcomeStart);
  assert.match(outcomeImplementation, /momentumMemoryOutcomesUpdated:\s*0/);
  assert.doesNotMatch(outcomeImplementation, /pool\.query|UPDATE\s+momentum_memory_observations|OFFSET\s+[024]/i);
});
