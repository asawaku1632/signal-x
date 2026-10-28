import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/admin/repeat-candidate-risk/route.ts", "utf8");
const page = readFileSync("app/admin/repeat-candidate-risk/page.tsx", "utf8");

test("admin-only and no-store protected route", () => {
  assert.match(route, /getAdminSession/);
  assert.match(route, /if \(!isAdmin\)/);
  assert.match(route, /status: 403/);
  assert.match(route, /private, no-store/);
});
test("repeat history uses prior CANDIDATE rows in time order", () => {
  assert.match(route, /decision_status = 'CANDIDATE'/);
  assert.match(route, /LAG\(entry_price\) OVER \(PARTITION BY code ORDER BY trade_date\)/);
  assert.match(route, /candidate_number > 1/);
  assert.match(route, /previous_candidate_price > 0/);
  assert.match(route, /LIMIT 300/);
});
test("strict read-only, no external provider calls or live decisions", () => {
  assert.doesNotMatch(route, /\b(?:INSERT|UPDATE|DELETE|UPSERT|ALTER|DROP|TRUNCATE)\s+(?:INTO\s+|FROM\s+|TABLE\s+)?public\./i);
  assert.doesNotMatch(route, /fetch\s*\(|sendLine|sendNotification|saveDailyStocks|updateSwingUniverseOutcomes/);
  assert.match(page, /研究専用/);
  assert.match(page, /直近300件のみ/);
  assert.match(page, /未検証/);
});
