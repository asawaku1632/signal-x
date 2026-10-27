import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateN225Chart } from "./step27-n225-offline-evaluator.mjs";

const source = readFileSync(new URL("../../admin/market-index-research/step27-offline-panel.tsx", import.meta.url), "utf8");
const checkedAt = new Date("2026-10-27T01:00:00Z");
const cases = [
  { name: "fresh", minutesAgo: 1, close: 50000, status: "observed", reason: "FRESH", age: 1 },
  { name: "stale", minutesAgo: 21, close: 50000, status: "stale", reason: "OLD_BAR", age: 21 },
  { name: "invalid", minutesAgo: 1, close: null, status: "invalid", reason: "LATEST_CLOSE_INVALID", age: 1 },
];
test("research UI calls the same evaluator and uses fixed offline inputs", () => {
  assert.match(source, /evaluateN225Chart\(/);
  assert.match(source, /const checkedAt = new Date\("2026-10-27T01:00:00Z"\)/);
  assert.match(source, /useState<Scenario>\("fresh"\)/);
  assert.doesNotMatch(source, /\bfetch\s*\(|\bXMLHttpRequest\b|\blocalStorage\b|\bWebSocket\b/);
});
for (const scenario of cases) {
  test(`UI simulated case ${scenario.name} maps to ${scenario.status}`, () => {
    assert.match(source, new RegExp(`\\b${scenario.name}: \\{ label: .*minutesAgo: ${scenario.minutesAgo}, close: ${scenario.close === null ? "null" : scenario.close} \\}`));
    const timestamp = checkedAt.getTime() / 1000 - scenario.minutesAgo * 60;
    const payload = { chart: { result: [{ meta: { symbol: "^N225" }, timestamp: [timestamp], indicators: { quote: [{ close: [scenario.close] }] } }] } };
    const actual = evaluateN225Chart(payload, checkedAt);
    assert.equal(actual.status, scenario.status);
    assert.equal(actual.reason, scenario.reason);
    assert.equal(actual.ageMinutes, scenario.age);
  });
}
