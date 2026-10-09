import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getSwingDecision } from "../app/lib/swingDecision.ts";
import { resolveTseTradingDatesAfter } from "../app/lib/technicalObservation/tseMarketCalendar.ts";

const read = (path) => readFileSync(path, "utf8");

test("profitable holding can still become EXIT when AI POWER drops", () => {
  const signal = getSwingDecision({
    currentPrice: 1768, entryPrice: 1747, aiPower: 46, rsi: 33, changePercent: 2.38,
  });
  assert.equal(signal.status, "EXIT");
  assert.equal(signal.label, "撤退候補");
  assert.ok(signal.pnlPercent > 1);
  assert.ok(signal.reasons.some((reason) => reason.includes("46")));
});

test("missing AI POWER must not be mistaken for zero and cause a false exit", () => {
  const signal = getSwingDecision({ currentPrice: 1001, entryPrice: 1000, aiPower: null, stopLoss: null });
  assert.notEqual(signal.status, "EXIT");
});

test("loss stop remains a valid independent exit reason without AI", () => {
  const signal = getSwingDecision({ currentPrice: 965, entryPrice: 1000, aiPower: null });
  assert.equal(signal.status, "EXIT");
});

test("market-calendar horizons skip weekends and Japanese exchange holidays", () => {
  const dates = resolveTseTradingDatesAfter("2026-10-08", 10, { maxLookaheadDays: 45 });
  assert.equal(dates[0], "2026-10-09");
  assert.equal(dates[1], "2026-10-13"); // 10/12 is a Japanese holiday.
  assert.equal(dates[2], "2026-10-14");
  assert.equal(dates[4], "2026-10-16");
  assert.equal(dates.length, 10);
});

test("audit captures decisions on server using a fresh scan and one event per position", () => {
  const source = read("app/lib/learning/swingExitAudit.ts");
  const api = read("app/api/swing-exit-audit/route.ts");
  assert.match(source, /MAX_SNAPSHOT_AGE_MS/);
  assert.match(source, /getSwingDecision/);
  assert.match(source, /decision\.status !== "EXIT"/);
  assert.match(source, /ON CONFLICT \(paper_trade_id\) DO NOTHING/);
  assert.match(source, /userEmail\?\.trim\(\)\.toLowerCase\(\)/);
  assert.match(api, /getServerSession/);
  assert.match(api, /captureSwingExitSignals\(email\)/);
  assert.doesNotMatch(api, /request\.json\(\)/);
});

test("outcomes compare exact trading days and do not extrapolate missing prices", () => {
  const source = read("app/lib/learning/swingExitAudit.ts");
  assert.match(source, /resolveTseTradingDatesAfter\(signalDate, 10/);
  assert.match(source, /positiveNumber\(row\.price\)/);
  assert.match(source, /COALESCE\(outcome_1d_price/);
  assert.match(source, /COALESCE\(outcome_10d_price/);
  assert.match(source, /trade\.id = audit\.paper_trade_id/);
  assert.match(source, /outcome\.changePercent !== null/);
});

test("protected scheduled job and private table are isolated from simulated selling", () => {
  const cron = read("app/api/cron/swing-exit-audit/route.ts");
  const sql = read("supabase/migrations/20261008_create_swing_exit_audits.sql");
  const simulation = read("app/simulation/page.tsx");
  const config = read("vercel.json");
  assert.match(cron, /requireCronAuth\(request\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL.*anon, authenticated/);
  assert.match(simulation, /\/simulation\/exit-check/);
  assert.ok(JSON.parse(config).crons.some((cron) =>
    cron.path === "/api/cron/swing-exit-audit" && cron.schedule === "5 7 * * 1-5"));
});

test("zero AI POWER is valid for real EXIT audit and +3% rebounds are reported", () => {
  const audit = read("app/lib/learning/swingExitAudit.ts");
  const page = read("app/simulation/exit-check/page.tsx");
  const signal = getSwingDecision({ currentPrice: 5803, entryPrice: 6310, aiPower: 0 });
  assert.equal(signal.status, "EXIT");
  assert.match(audit, /power < 0 \|\| power > 100/);
  assert.doesNotMatch(audit, /power <= 0/);
  assert.match(audit, /outcome\.changePercent! >= 3/);
  assert.match(audit, /reboundRatePercent/);
  assert.match(page, /撤退判定後に\+3%以上の反発を確認/);
  assert.match(page, /確認待ち/);
});
