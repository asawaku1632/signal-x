import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateNanpin, compareNanpinAtPrice } from "../app/lib/nanpinScenario.ts";

const example = { entryPrice: 1000, heldShares: 100, addPrice: 800, addShares: 100, futurePrice: 900 };

test("1000→800 example: break-even moves to 900 but no money is earned by the averaging itself", () => {
  const r = calculateNanpin(example);
  assert.ok(r);
  assert.equal(r.initialCost, 100000);
  assert.equal(r.additionalCost, 80000);
  assert.equal(r.totalCost, 180000);
  assert.equal(r.totalShares, 200);
  assert.equal(r.averagePrice, 900);
  assert.equal(r.lowerBreakEvenBy, 100);
  assert.equal(r.selected.beforeYen, -10000);
  assert.equal(r.selected.afterYen, 0);
  assert.equal(r.selected.differenceYen, 10000);
});

test("at 700 adding doubles the loss exposure of the second 100 shares", () => {
  const r = compareNanpinAtPrice(example, 700);
  assert.equal(r.beforeYen, -30000);
  assert.equal(r.afterYen, -40000);
  assert.equal(r.differenceYen, -10000);
});

test("extra 10% decline is compared against the addition price", () => {
  const r = calculateNanpin(example);
  assert.ok(r);
  assert.equal(r.downTenPercentPrice, 720);
  assert.equal(r.downTenPercent.beforeYen, -28000);
  assert.equal(r.downTenPercent.afterYen, -36000);
});

test("wrong or dangerous quantities/prices are rejected", () => {
  for (const invalid of [
    { ...example, heldShares: 0 },
    { ...example, addShares: 1.5 },
    { ...example, addPrice: -800 },
    { ...example, futurePrice: Number.NaN },
    { ...example, entryPrice: Infinity },
  ]) assert.equal(calculateNanpin(invalid), null);
});

test("read-only simulator does not add a purchase, mutate portfolio, or contact write APIs", () => {
  const page = readFileSync("app/simulation/nanpin/page.tsx", "utf8");
  const simulation = readFileSync("app/simulation/page.tsx", "utf8");
  assert.match(simulation, /\/simulation\/nanpin/);
  assert.match(page, /GET/);
  assert.match(page, /保存しません/);
  assert.doesNotMatch(page, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
  assert.doesNotMatch(page, /\/api\/run|\/api\/cron/);
});
