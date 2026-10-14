import test from "node:test";
import assert from "node:assert/strict";
import { preferStockSnapshot } from "../app/lib/preferStockSnapshot.mjs";

function saved(price, barTime, updatedAt) {
  return { updatedAt, payload: { price, score: price / 100, latestBarTimestamp: barTime } };
}

test("full-market row wins when individual has an older quote despite later save", () => {
  const individual = saved(3205, 1000, "2026-10-14T02:05:00Z");
  const market = saved(3165, 1100, "2026-10-14T02:04:53Z");
  assert.equal(preferStockSnapshot(individual, market), market);
});

test("individual row wins when it has a truly newer market bar", () => {
  const individual = saved(3160, 1200, "2026-10-14T02:01:00Z");
  const market = saved(3165, 1100, "2026-10-14T02:04:53Z");
  assert.equal(preferStockSnapshot(individual, market), individual);
});

test("same market bar favors full-market row to align Favorites and Analysis", () => {
  const individual = saved(3205, 1100, "2026-10-14T02:07:00Z");
  const market = saved(3165, 1100, "2026-10-14T02:04:53Z");
  assert.equal(preferStockSnapshot(individual, market), market);
});

test("older saved market row does not replace newer undated individual row", () => {
  const individual = saved(3160, null, "2026-10-14T02:05:00Z");
  const market = saved(3165, null, "2026-10-14T02:04:53Z");
  assert.equal(preferStockSnapshot(individual, market), individual);
});

test("missing records and malformed timestamps are handled safely", () => {
  const market = saved(3165, "bad", "2026-10-14T02:04:53Z");
  assert.equal(preferStockSnapshot(null, market), market);
  assert.equal(preferStockSnapshot(null, null), null);
  assert.equal(preferStockSnapshot(saved(3100, null, "bad"), market), market);
});
