import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/lib/learning/trendPullbackReversal.ts", import.meta.url), "utf8");
const start = source.indexOf("WITH latest AS(");
const end = source.indexOf("`,[targetDate])", start);
assert.ok(start >= 0 && end > start, "Cannot locate the TPR observation SQL");
const sql = source.slice(start, end);

test("TPR observation query is parameterized by target date", () => {
  assert.match(sql, /trade_date=\$1::date/);
});
test("TPR observation query inserts only once per trade date and code", () => {
  assert.match(sql, /ON CONFLICT\s*\(trade_date,code\)\s*DO NOTHING/i);
  assert.doesNotMatch(sql, /ON CONFLICT\s*\(trade_date,code\)\s*DO UPDATE/i);
});
test("TPR observation query uses as-of timestamps for historical prices", () => {
  assert.match(sql, /d3\.created_at\s*<=\s*\(p\.created_at AT TIME ZONE 'UTC'\)/);
  assert.match(sql, /d0\.created_at\s*<=\s*\(p\.created_at AT TIME ZONE 'UTC'\)/);
});
test("TPR observation query keeps market snapshot as-of", () => {
  assert.match(sql, /ml\.created_at<=p\.created_at/);
});
