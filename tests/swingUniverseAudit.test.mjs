import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSwingEntryDecision } from "../app/lib/swingDecision.ts";
import { resolveTseTradingDatesAfter } from "../app/lib/technicalObservation/tseMarketCalendar.ts";

const read = (path) => readFileSync(path, "utf8");
const audit = read("app/lib/learning/swingUniverseAudit.ts");

test("AI POWER-only classification yields four distinct entry statuses", () => {
  assert.equal(getSwingEntryDecision({ aiPower: 90 }).status, "CANDIDATE");
  assert.equal(getSwingEntryDecision({ aiPower: 80 }).status, "WAIT");
  assert.equal(getSwingEntryDecision({ aiPower: 70 }).status, "WATCH");
  assert.equal(getSwingEntryDecision({ aiPower: 40 }).status, "AVOID");
});

test("AI POWER-only labels never promise the same result as full RSI-based signal", () => {
  assert.equal(getSwingEntryDecision({ aiPower: 90 }).status, "CANDIDATE");
  assert.equal(getSwingEntryDecision({ aiPower: 90, rsi: 80 }).status, "WAIT");
  assert.match(audit, /AI POWER alone/);
  assert.match(read("app/simulation/universe-check/page.tsx"), /簡易判定/);
});

test("trading calendar avoids weekends and Japanese public holidays", () => {
  const dates = resolveTseTradingDatesAfter("2026-10-08", 10, { maxLookaheadDays: 45 });
  assert.deepEqual(dates.slice(0, 3), ["2026-10-09", "2026-10-13", "2026-10-14"]);
  assert.equal(dates[4], "2026-10-16");
  assert.equal(dates.length, 10);
});

test("capture requires market close, complete daily coverage, and idempotency", () => {
  assert.match(audit, /isTseTargetDateReady\(targetDate, now\)/);
  assert.match(audit, /validateDailyScanCoverage/);
  assert.match(audit, /INVALID_PRICES_OR_SCORES/);
  assert.match(audit, /ON CONFLICT \(trade_date, code\) DO NOTHING/);
  assert.match(audit, /UNIVERSE_SWING_RULE_VERSION/);
  assert.match(audit, /INSERT_BATCH_SIZE = 200/);
});

test("the outcome query compares exact trading dates and does not fill missing data", () => {
  assert.match(audit, /resolveTseTradingDatesAfter\(signalDate, 10/);
  assert.match(audit, /future\.date = targets\.price_date/);
  assert.match(audit, /obs\.outcome_\$\{days\}d_date IS NULL/);
  assert.match(audit, /future\.price > 0/);
  assert.match(audit, /GROUP BY decision_status/);
});

test("private data, authorized independent scheduled execution, no live model changes", () => {
  const sql = read("supabase/migrations/20261008_create_swing_universe_observations.sql");
  const cron = read("app/api/cron/swing-universe-audit/route.ts");
  const route = read("app/api/swing-universe-audit/route.ts");
  const vercel = JSON.parse(read("vercel.json"));
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL.*anon, authenticated/);
  assert.match(cron, /requireCronAuth\(request\)/);
  assert.match(route, /getServerSession\(authOptions\)/);
  assert.ok(vercel.crons.some((item) =>
    item.path === "/api/cron/swing-universe-audit" && item.schedule === "20 7 * * 1-5"));
  assert.doesNotMatch(audit, /UPDATE\s+(?:public\.)?paper_trades/i);
  assert.doesNotMatch(audit, /UPDATE\s+(?:public\.)?weight_rules/i);
});

test("full-universe UI has a user-accessible path and no zero-sample win rate", () => {
  const simulation = read("app/simulation/page.tsx");
  const page = read("app/simulation/universe-check/page.tsx");
  assert.match(simulation, /\/simulation\/universe-check/);
  assert.match(page, /集計待ち/);
  assert.match(page, /見送り.*下落の予測ではありません/);
  assert.match(page, /code=\$\{encodeURIComponent\(filter\)\}/);
});

test("forward-only full-universe audit compares +3% rebounds without equating AVOID and EXIT", () => {
  const audit = read("app/lib/learning/swingUniverseAudit.ts");
  const page = read("app/simulation/universe-check/page.tsx");
  assert.match(audit, /return_1d >= 3/);
  assert.match(audit, /return_10d >= 3/);
  assert.match(audit, /rebounded: Number/);
  assert.match(page, /見送り後の反発/);
  assert.match(page, /撤退候補後の反発/);
  assert.match(page, /outcome\.rebounded \/ outcome\.checked/);
  assert.match(page, /集計待ち/);
});

test("AVOID score breakdown uses exactly four disjoint numeric boundaries without changing stored status", () => {
  assert.match(audit, /'0-19', 1, 0::numeric, 20::numeric/);
  assert.match(audit, /'20-39', 2, 20::numeric, 40::numeric/);
  assert.match(audit, /'40-54', 3, 40::numeric, 55::numeric/);
  assert.match(audit, /'55-64', 4, 55::numeric, 65::numeric/);
  assert.match(audit, /obs\.decision_status = 'AVOID'/);
  assert.match(audit, /obs\.ai_power >= bands\.min_power AND obs\.ai_power < bands\.max_power/);
  assert.match(audit, /WHERE obs\.rule_version = \$1/);
  assert.doesNotMatch(audit, /UPDATE\s+public\.swing_universe_observations\s+SET\s+decision_status/);
});

test("the breakdown counts only verified horizon prices, including zero observations and downside", () => {
  assert.match(audit, /VALUES \(1, m\.return_1d\), \(3, m\.return_3d\)/);
  assert.match(audit, /\(5, m\.return_5d\), \(10, m\.return_10d\)/);
  assert.match(audit, /COUNT\(e\.ret\)::text AS checked/);
  assert.match(audit, /COUNT\(DISTINCT e\.trade_date\) FILTER \(WHERE e\.ret IS NOT NULL\)/);
  assert.match(audit, /e\.ret > 0/);
  assert.match(audit, /e\.ret < 0/);
  assert.match(audit, /e\.ret >= 3/);
  assert.match(audit, /e\.ret <= -3/);
  assert.match(audit, /PERCENTILE_CONT\(0\.5\)/);
  assert.match(audit, /ROUND\(MIN\(e\.ret\), 2\)/);
  assert.match(audit, /avoidBreakdown,/);
});

test("the mobile UI shows 1/3/5/10 day counts, downside, missingness and EXIT distinction", () => {
  const page = read("app/simulation/universe-check/page.tsx");
  assert.match(page, /report\.avoidBreakdown\.map/);
  assert.match(page, /見送り.*AI POWER別・反発検証/);
  assert.match(page, /o\.checkedDays/);
  assert.match(page, /o\.minus3/);
  assert.match(page, /o\.worstReturnPercent/);
  assert.match(page, /o\.medianReturnPercent/);
  assert.match(page, /checked \? \(100 \* count \/ checked\)/);
  assert.match(page, /新しい「弱いAI判定からの逆張り反発研究」/);
  assert.match(page, /実際の「撤退候補」/);
  assert.doesNotMatch(page, /自動購入|買い確定/);
});

test("research capture accepts numeric and alphanumeric stock codes", () => {
  const pattern = /^(?:[0-9]{4}|[0-9]{3}[A-Z])$/;

  assert.match(
    audit,
    /if \(!\/\^\(\?:\[0-9\]\{4\}\|\[0-9\]\{3\}\[A-Z\]\)\$\/\.test\(row\.code\)/
  );

  for (const code of ["7203", "1301", "590A", "641A", "642A"]) {
    assert.equal(pattern.test(code), true);
  }

  for (const code of ["123", "12345", "59A", "ABCD", "590a"]) {
    assert.equal(pattern.test(code), false);
  }
});
