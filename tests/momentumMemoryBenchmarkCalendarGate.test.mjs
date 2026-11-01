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
