import assert from "node:assert/strict";
import { test } from "node:test";
import { roundDownToTseOrderTick } from "./tseOrderTick.ts";

test("3,219 yen from overnight reference rounds DOWN to an orderable 3,215 yen", () => {
  assert.deepEqual(roundDownToTseOrderTick(3219), { priceYen: 3215, tickYen: 5 });
  assert.deepEqual(roundDownToTseOrderTick(3220), { priceYen: 3220, tickYen: 5 });
  assert.deepEqual(roundDownToTseOrderTick(3219.9), { priceYen: 3215, tickYen: 5 });
});

test("TSE standard cash equity ticks at price-tier boundaries", () => {
  const cases: [number, number][] = [
    [2999, 2999], [3000, 3000], [3004, 3000],
    [5000, 5000], [5009, 5000], [5019, 5010],
    [30000, 30000], [30049, 30000], [30099, 30050],
    [50000, 50000], [50099, 50000], [100099, 100000],
    [300499, 300000], [500999, 500000],
    [3000999, 3000000], [5009999, 5000000],
    [30049999, 30000000], [50099999, 50000000],
  ];
  for (const [input, expected] of cases) {
    const actual = roundDownToTseOrderTick(input);
    assert.equal(actual?.priceYen, expected, "input " + input);
    assert.ok(actual && actual.priceYen <= input, "must never exceed raw upper bound");
  }
});

test("invalid or unusable input does not create a false reference", () => {
  for (const input of [0, -1, 0.9, NaN, Infinity, -Infinity]) {
    assert.equal(roundDownToTseOrderTick(input), null);
  }
});
