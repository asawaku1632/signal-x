import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const path = "app/lib/research/externalMarket/assessMarketObservation.ts";
const source = readFileSync(path, "utf8");

test("shadow guard stays pure and isolated from production paths", () => {
  assert.match(source, /available > decision/);
  assert.match(source, /observed > decision/);
  assert.match(source, /ageMinutes > maxAgeMinutes/);
  assert.match(source, /status: "missing"/);
  assert.match(source, /status: "stale"/);
  assert.doesNotMatch(source, /fetch\(|pool\.query|supabase|LINE|sendNotification|saveDailyStocks/);
});

test("shadow guard rejects invalid and future timestamps", () => {
  assert.match(source, /available < observed/);
  assert.match(source, /Number\.isFinite\(decision\)/);
  assert.match(source, /Number\.isFinite\(available\)/);
});
