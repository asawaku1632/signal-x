import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPriceReferenceTrend, priceRangeLabel } from "../app/lib/learning/priceReferenceTrendAnalysis.ts";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const rows = [
  ["2730","エディオン",2370,2370],
  ["4062","イビデン",11630,11515],
  ["4493","サイバーセキュリティ",3660,3700],
  ["4502","武田薬品",5844,5843],
  ["6740","JDI",40,39],
  ["6758","ソニーG",3814,3814],
  ["7182","ゆうちょ銀行",3207,3178],
  ["7203","トヨタ",2911,2910.5],
  ["9502","中部電力",2646.5,2668.5],
  ["9984","ソフトバンクG",5838,5803],
].map(([code,name,baseline,reference])=>({
  trade_date:"2026-10-09", code, name,
  baseline_price:baseline, reference_price:reference,
  baseline_saved_hour_jst:15, observation_date_jst:"2026-10-10",
  reference_source:"YAHOO_CHART_1D",
}));

test("10 production-observed reference fixtures: 2 equal, 8 different, one trade date", () => {
  const data = buildPriceReferenceTrend(rows);
  assert.equal(data.summary.records, 10);
  assert.equal(data.summary.tradeDays, 1);
  assert.equal(data.summary.distinctSecurities, 10);
  assert.equal(data.summary.matched, 2);
  assert.equal(data.summary.differing, 8);
  assert.equal(data.summary.overHalfPercent, 6);
  assert.equal(data.summary.enoughDatesForTrend, false);
  assert.equal(data.summary.enoughSaveHoursForComparison, false);
  assert.equal(data.bySaveHour.length, 1);
  assert.equal(data.bySaveHour[0].label, "15時台（JST）");
  assert.equal(data.byTradeDate[0].label, "2026-10-09");
  assert.equal(data.byTradeDate[0].records, 10);
});
test("reports correct groups, ranking by percent not yen, and transparent simple sector labels", () => {
  const data = buildPriceReferenceTrend(rows);
  assert.equal(data.examples[0].code, "6740"); // JDI: one-yen gap, >2% relative
  assert.equal(data.examples.find((r)=>r.code==="9984")?.differenceYen, 35);
  assert.ok(data.bySector.some((r)=>r.label==="自動車" && r.records===1));
  assert.ok(data.bySector.some((r)=>r.label==="電機・精密" && r.matched===1));
  assert.ok(data.bySector.some((r)=>r.label==="その他・未分類" && r.records>=1));
  assert.equal(priceRangeLabel(999), "1,000円未満");
  assert.equal(priceRangeLabel(1000), "1,000〜2,999円");
  assert.equal(priceRangeLabel(3000), "3,000〜9,999円");
  assert.equal(priceRangeLabel(10000), "10,000円以上");
});
test("empty dataset / invalid values do not fabricate trends or divide by zero", () => {
  const data = buildPriceReferenceTrend([]);
  assert.deepEqual(data.bySector, []);
  assert.equal(data.summary.records, 0);
  assert.equal(data.summary.meanAbsPercent, null);
  const bad = buildPriceReferenceTrend([
    { ...rows[0], reference_price: 0 },
    { ...rows[1], baseline_price: null },
    { ...rows[2], baseline_saved_hour_jst: null },
  ]);
  assert.equal(bad.summary.records, 1);
  assert.equal(bad.bySaveHour[0].label, "時刻未記録");
});
test("read-only SQL selects newest audit for each trade date and security, bounded range", () => {
  const q = read("app/lib/learning/priceReferenceTrend.ts");
  assert.match(q, /SELECT DISTINCT ON \(trade_date, code\)/);
  assert.match(q, /observation_date_jst DESC, observed_at DESC, id DESC/);
  assert.match(q, /LIMIT \$2/);
  assert.match(q, /MAX_RESEARCH_ROWS \+ 1/);
  assert.match(q, /trade_date >= \$1::date - INTERVAL '89 days'/);
  assert.doesNotMatch(q, /\bINSERT INTO\b|\bUPDATE\b|\bDELETE FROM\b|\bfetch\(/i);
});
test("report API is admin only, contains no Yahoo access, writes, cron or notifications", () => {
  const api = read("app/api/admin/price-reference-trend/route.ts");
  const page = read("app/admin/price-reference-trend/page.tsx");
  assert.match(api, /getAdminSession/);
  assert.match(api, /if \(!isAdmin\)/);
  assert.match(api, /getPriceReferenceTrend/);
  assert.match(api, /private, no-store/);
  assert.doesNotMatch(api, /\bPOST\b|\bfetch\(|sendNotification|runScan|saveDailyStocks/);
  assert.match(page, /集計の切り替え/);
  assert.match(page, /業種別/);
  assert.match(page, /保存時刻別/);
  assert.match(page, /十分|記録がない|5取引日分/);
  assert.match(read("app/admin/daily-price-reference/page.tsx"), /\/admin\/price-reference-trend/);
});
