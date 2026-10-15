import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("app/lib/research/externalMarket/assessMarketObservation.ts", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { assessMarketObservation: assess } = await import("data:text/javascript," + encodeURIComponent(js));

const observation = {
  symbol: "^GSPC", value: 5800, source: "test-fixture",
  observedAt: "2026-10-15T20:00:00Z",
  availableAt: "2026-10-15T20:05:00Z",
};

test("valid reference is usable after availability", () => {
  const result = assess(observation, "2026-10-15T20:10:00Z", 60);
  assert.equal(result.status, "usable");
  assert.equal(result.ageMinutes, 10);
});
test("missing reference is never guessed", () => {
  assert.equal(assess(null, "2026-10-15T20:10:00Z", 60).status, "missing");
});
test("no lookahead: reference published after decision", () => {
  assert.equal(assess(observation, "2026-10-15T20:03:00Z", 60).status, "future");
});
test("stale reference cannot be used", () => {
  assert.equal(assess(observation, "2026-10-16T20:10:00Z", 60).status, "stale");
});
test("invalid or nonpositive prices are rejected", () => {
  assert.equal(assess({ ...observation, value: 0 }, "2026-10-15T20:10:00Z", 60).status, "invalid");
  assert.equal(assess({ ...observation, value: NaN }, "2026-10-15T20:10:00Z", 60).status, "invalid");
});
test("publication before observation is invalid", () => {
  assert.equal(assess({ ...observation, availableAt: "2026-10-15T19:00:00Z" }, "2026-10-15T20:10:00Z", 60).status, "invalid");
});
