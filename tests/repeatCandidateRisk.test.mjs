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
  assert.match(route, /ai_power >= 90/);
  assert.match(route, /LIMIT 1001/);
  assert.match(route, /rows: result.rows.slice\(0, 1000\)/);
});
test("strict read-only, no external provider calls or live decisions", () => {
  assert.doesNotMatch(route, /\b(?:INSERT|UPDATE|DELETE|UPSERT|ALTER|DROP|TRUNCATE)\s+(?:INTO\s+|FROM\s+|TABLE\s+)?public\./i);
  assert.doesNotMatch(route, /fetch\s*\(|sendLine|sendNotification|saveDailyStocks|updateSwingUniverseOutcomes/);
  assert.match(page, /研究専用/);
  assert.match(page, /直近1000件のみ/);
  assert.match(page, /未検証/);
});

test("research summary distinguishes observed outcomes from incomplete follow-up", () => {
  assert.match(page, /completed\.length/);
  assert.match(page, /評価済/);
  assert.match(page, /日付・業種・POWERを調整していない/);
  assert.match(page, /将来の予測能力や除外効果は示しません/);
});

test("same-day comparisons require both groups to have completed outcomes", () => {
  assert.match(page, /byDate\.get\(row\.trade_date\)/);
  assert.match(page, /group\.risk\.length && group\.other\.length/);
  assert.match(page, /同じ判定日の5日後結果を比較/);
  assert.match(page, /業種や銘柄構成の差は残ります/);
  assert.match(page, /独立した終値検証・将来の再現性は未確認/);
});
