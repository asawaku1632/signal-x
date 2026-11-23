import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/lib/learning/patternForwardLearning.ts", import.meta.url), "utf8");

test("forward outcomes use one bounded price lookup rather than three", () => {
  const start = source.indexOf("export async function updatePatternForwardOutcomes(");
  const end = source.indexOf("export async function refreshPatternForwardStats(", start);
  const body = source.slice(start, end);
  assert.equal((body.match(/LEFT JOIN LATERAL/g) ?? []).length, 1);
  assert.match(body, /LIMIT 5/);
  for (const rank of [1, 3, 5]) assert.match(body, new RegExp(`rn = ${rank}`));
  assert.match(body, /return_5d = COALESCE\(p\.return_5d, c\.return_5d\)/);
});

test("single scan preserves original 1st, 3rd and 5th row offsets", () => {
  for (const count of [0, 1, 2, 3, 4, 5, 8]) {
    const prices = Array.from({ length: count }, (_, i) => i + 100);
    const bounded = prices.slice(0, 5);
    for (const [offset, rank] of [[0, 1], [2, 3], [4, 5]]) {
      assert.equal(bounded[rank - 1] ?? null, prices[offset] ?? null);
    }
  }
});
