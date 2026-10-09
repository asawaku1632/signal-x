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
