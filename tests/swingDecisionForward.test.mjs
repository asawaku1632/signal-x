import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSwingDecision } from "../app/lib/swingDecision.ts";
import { summarizeDecisionForward } from "../app/lib/learning/swingDecisionForwardMath.ts";

const read = path => readFileSync(path, "utf8");
const item = (decisionStatus, changePercent, cohort = "MANUAL", code = "3543") => ({
  id: code + ":" + decisionStatus,
  code, name: code, signalDate: "2026-11-09",
  scanAt: "2026-11-09T01:52:22Z", signalPrice: 3000,
  aiPower: decisionStatus === "EXIT" ? 46 : 92,
  decisionStatus, cohort, reasons: [],
  outcomes: [1, 3, 5, 10].map(days => ({
    days, date: changePercent === null ? null : "2026-11-10",
    price: changePercent === null ? null : 3000 * (1 + changePercent / 100),
    changePercent,
  })),
});

test("one snapshot compares HOLD upside and EXIT downside with disjoint cohorts", () => {
  const group = summarizeDecisionForward([
    item("HOLD", 2, "MANUAL", "3774"),
    item("HOLD", -1, "MANUAL", "7164"),
    item("EXIT", -3, "MANUAL", "3543"),
    item("EXIT", 4, "CRON", "3543"),
  ]);
  const manualHold = group.find(g => g.cohort === "MANUAL" && g.decisionStatus === "HOLD");
  const manualExit = group.find(g => g.cohort === "MANUAL" && g.decisionStatus === "EXIT");
  const cronExit = group.find(g => g.cohort === "CRON" && g.decisionStatus === "EXIT");
  assert.equal(manualHold.total, 2);
  assert.equal(manualHold.horizons[0].correctRate, 50);
  assert.equal(manualHold.horizons[0].averagePercent, 0.5);
  assert.equal(manualExit.horizons[0].correctRate, 100);
  assert.equal(cronExit.horizons[0].correctRate, 0);
});

test("missing outcomes are excluded rather than counted as losses", () => {
  const result = summarizeDecisionForward([
    item("EXIT", null), item("EXIT", -2, "MANUAL", "4503"),
  ]);
  const exit = result.find(g => g.cohort === "MANUAL" && g.decisionStatus === "EXIT");
  assert.equal(exit.total, 2);
  assert.equal(exit.horizons[0].evaluated, 1);
  assert.equal(exit.horizons[0].correctRate, 100);
});

test("displayed profitable EXIT and profitable HOLD are classified by exact swing rule", () => {
  const exit = getSwingDecision({ currentPrice: 2990, entryPrice: 2928, aiPower: 46 });
  const hold = getSwingDecision({ currentPrice: 3780, entryPrice: 3607, aiPower: 92 });
  assert.equal(exit.status, "EXIT");
  assert.equal(hold.status, "HOLD");
});

test("data is captured from fresh server snapshot with no browser-provided prices", () => {
  const service = read("app/lib/learning/swingDecisionForward.ts");
  const api = read("app/api/swing-decision-forward/route.ts");
  const cron = read("app/api/cron/swing-exit-audit/route.ts");
  assert.match(service, /getLatestScanSnapshot/);
  assert.match(service, /MAX_SNAPSHOT_AGE_MS/);
  assert.match(service, /getSwingDecision/);
  assert.match(service, /ON CONFLICT \(paper_trade_id,signal_date,cohort\) DO NOTHING/);
  assert.match(service, /sessions\[days - 1\] < today/);
  assert.match(service, /resolveTseTradingDatesAfter/);
  assert.match(api, /getServerSession/);
  assert.doesNotMatch(api, /request\.json\(/);
  assert.match(cron, /captureSwingDecisionForward\("CRON"\)/);
  assert.match(cron, /updateSwingDecisionForwardOutcomes/);
});

test("private RLS, independent price checkpoints, and no order or notification code", () => {
  const sql = read("supabase/migrations/20261109_create_swing_decision_forward_observations.sql");
  const service = read("app/lib/learning/swingDecisionForward.ts");
  const page = read("app/simulation/decision-check/page.tsx");
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL.*anon, authenticated/);
  assert.match(sql, /UNIQUE \(paper_trade_id, signal_date, cohort\)/);
  assert.match(page, /現在の判定を保存/);
  assert.match(page, /手動保存/);
  assert.match(page, /定時保存/);
  assert.doesNotMatch(service, /sendPush|placeOrder|executeOrder/);
});
