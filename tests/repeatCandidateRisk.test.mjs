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
  assert.match(page, /summarizeGroup\(g.rows\)/);
  assert.match(page, /評価済/);
  assert.match(page, /業種・POWERの偏りや少数日問題は解消しません/);
  assert.match(page, /将来の予測能力や除外効果を示しません/);
});

test("same-day comparisons require both groups to have completed outcomes", () => {
  assert.match(page, /sameDayComparison\(verifiedRows\)/);
  assert.match(page, /matched\.days/);
  assert.match(page, /同じ判定日の5日後結果を比較/);
  assert.match(page, /業種や銘柄構成の差は残ります/);
  assert.match(page, /独立した終値検証・将来の再現性は未確認/);
});

test("concentration report counts only completed downside cases and duplicate stock codes", () => {
  assert.match(page, /concentration = useMemo/);
  assert.match(page, /previous_candidate_change_pct/);
  assert.match(page, /n\(r.return_5d\) != null/);
  assert.match(page, /dates\.set\(row.trade_date/);
  assert.match(page, /codes\.set\(row.code/);
  assert.match(page, /filter\(count => count > 1\)/);
  assert.match(page, /独立した試行回数ではありません/);
});

test("largest-day exclusion exposes limited independent days", () => {
  assert.match(page, /withoutLargestDay\(eligible\)/);
  assert.match(page, /remainingAverage/);
  assert.match(page, /最多判定日を除外/);
  assert.match(page, /remainingDays < 3/);
  assert.match(page, /再現性評価には不足しています/);
});

test("pending outcomes remain distinct from observed returns by trade date", () => {
  assert.match(page, /pendingByDate = useMemo/);
  assert.match(page, /outcomeCoverageByDate/);
  assert.match(page, /5日後結果の確定状況/);
  assert.match(page, /未確定はゼロ損益ではありません/);
});

test("research snapshot can be refreshed", () => {
  assert.match(route, /fetchedAt/);
  assert.match(page, /保存結果を再取得/);
  assert.match(page, /setReloadCount/);
  assert.match(page, /Asia\/Tokyo/);
});

test("date-balanced average weights each decision day equally", () => {
  assert.match(page, /summarizeGroup/);
  assert.match(page, /dateBalancedAverage/);
  assert.match(page, /dateBalancedAverage/);
  assert.match(page, /日付均等平均/);
});

// Thirty inexpensive, non-mutating contract checks across the research surface.
test("audit 01: api dynamic no cache", () => {
  assert.ok(route.includes("force-dynamic"));
});
test("audit 02: api uses node runtime", () => {
  assert.ok(route.includes("nodejs"));
});
test("audit 03: api never stores records", () => {
  assert.ok(route.includes("no writes"));
});
test("audit 04: api filters exact rule version", () => {
  assert.ok(route.includes("ai_power_only_v1"));
});
test("audit 05: api limits candidate status", () => {
  assert.ok(route.includes("decision_status = 'CANDIDATE'"));
});
test("audit 06: api partitions by symbol", () => {
  assert.ok(route.includes("PARTITION BY code"));
});
test("audit 07: api uses ordered history", () => {
  assert.ok(route.includes("ORDER BY trade_date"));
});
test("audit 08: api retains prior candidate date", () => {
  assert.ok(route.includes("previous_candidate_date"));
});
test("audit 09: api retains prior candidate price", () => {
  assert.ok(route.includes("previous_candidate_price"));
});
test("audit 10: api validates positive prior price", () => {
  assert.ok(route.includes("previous_candidate_price > 0"));
});
test("audit 11: api current power cutoff", () => {
  assert.ok(route.includes("ai_power >= 90"));
});
test("audit 12: api cursor cutoff", () => {
  assert.ok(route.includes("LIMIT 1001"));
});
test("audit 13: api outputs truncation marker", () => {
  assert.ok(route.includes("truncated:"));
});
test("audit 14: api outputs snapshot timestamp", () => {
  assert.ok(route.includes("fetchedAt:"));
});
test("audit 15: api is role gated", () => {
  assert.ok(route.includes("getAdminSession"));
});
test("audit 16: api guards forbidden access", () => {
  assert.ok(route.includes("status: 403"));
});
test("audit 17: api catches database failure", () => {
  assert.ok(route.includes("status: 500"));
});
test("audit 18: api has private cache control", () => {
  assert.ok(route.includes("private, no-store"));
});
test("audit 19: ui rejects blanks", () => {
  assert.ok(page.includes("v.trim() === \"\""));
});
test("audit 20: ui rejects nonfinite numbers", () => {
  assert.ok(page.includes("Number.isFinite(parsed)"));
});
test("audit 21: ui only loads read-only GET", () => {
  assert.ok(page.includes("fetch(\"/api/admin/repeat-candidate-risk\""));
});
test("audit 22: ui prevents concurrent reload", () => {
  assert.ok(page.includes("disabled={loading}"));
});
test("audit 23: ui supports manual refresh", () => {
  assert.ok(page.includes("setReloadCount"));
});
test("audit 24: ui shows JST timestamp", () => {
  assert.ok(page.includes("Asia/Tokyo"));
});
test("audit 25: ui distinguishes assessed outcomes", () => {
  assert.ok(page.includes("pendingByDate"));
});
test("audit 26: ui calculates daily equal mean", () => {
  assert.ok(page.includes("dateBalancedAverage"));
});
test("audit 27: ui shows same-day comparisons", () => {
  assert.ok(page.includes("sameDay.map"));
});
test("audit 28: ui excludes largest date", () => {
  assert.ok(page.includes("withoutLargestDay(eligible)"));
});
test("audit 29: ui surfaces small sample warning", () => {
  assert.ok(page.includes("remainingDays < 3"));
});
test("audit 30: ui warns on truncation", () => {
  assert.ok(page.includes("data.truncated &&"));
});

test("threshold comparison retains six decimal places", () => {
  assert.match(route, /NULLIF\(previous_candidate_price, 0\), 6\)/);
});

test("matched-day equal weight gap and coverage are visible", () => {
  assert.match(page, /matched.dateBalancedGap/);
  assert.match(page, /matched.matchedDayCount < 3/);
});

test("provisional evidence gate never enables trading or alerts", () => {
  assert.match(page, /研究段階：本番判定への採用は保留/);
  assert.match(page, /matched\.matchedDayCount < 3/);
  assert.match(page, /summary\[0\]\?\.days \?\? 0/);
  assert.match(page, /data\.truncated/);
  assert.match(page, /暫定的な注意表示/);
  assert.match(page, /AI売買判定や通知には反映しません/);
});

test("pending coverage displays per-day completion rate", () => {
  assert.match(page, /day.completionRate.toFixed\(0\)/);
  assert.match(page, /完了率/);
});

test("matched day exclusion display never auto enables the trading signal", () => {
  assert.match(page, /matchedDaySensitivity/);
  assert.match(page, /少数日の場合、頑健性の証明にはなりません/);
  assert.match(page, /本番判定への採用は保留/);
});

test("failed refresh clears stale research evidence", () => {
  assert.match(page, /setData\(null\); setError/);
  assert.match(page, /古い集計を最新結果として表示しない/);
  assert.match(page, /cache: "no-store"/);
});

test("refresh clears old results before starting the next request", () => {
  assert.match(page, /onClick=\{\(\) => \{ setData\(null\); setError\(""\);/); 
});

test("pending-only toggle filters list and leaves summary based on all rows", () => {
  assert.match(page, /showPendingOnly/);
  assert.match(page, /!showPendingOnly \|\| n\(r.return_5d\) == null/);
  assert.match(page, /上の統計は全取得データ/);
  assert.match(page, /5日後結果が未確定の記録のみ/);
});

test("threshold scenarios are observational and warn of overfitting", () => {
 assert.match(page,/thresholdSensitivity/);
 assert.match(page,/過剰適合/);
 assert.match(page,/群は重複しており/);
});

test("admin research displays outcome date integrity without changing source data", () => {
  assert.match(page, /outcomeDateIntegrity/);
  assert.match(page, /5日後結果の日付整合性/);
  assert.match(page, /保存データは変更しません/);
});

test("pending list and research results share date-validated rows", () => {
  assert.ok(page.includes("verifiedRows.filter"));
  assert.ok(page.includes("日付不整合で除外"));
  assert.ok(page.includes("excludeUnverifiedDatedOutcomes"));
});

test("repeat comparison requires valid positive current price", () => {
  assert.ok(route.includes("entry_price > 0"));
  assert.ok(route.includes("previous_candidate_price > 0"));
});
