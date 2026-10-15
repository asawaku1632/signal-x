import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  analyzePrecloseStudy, statsForPreclose, PRECLOSE_POLICY,
} from "../app/lib/research/precloseCandidateStudy.ts";

function d(day) {
  return new Date(Date.UTC(2026, 9, day + 16)).toISOString().slice(0, 10);
}
function observation(day, index, options = {}) {
  const entryPrice = 1000;
  const { aiPower = index < 15 ? 95 : 70, returnPct = index < 15
    ? index % 5 === 0 ? -3 : 3
    : -2.5, outcomePrice = entryPrice * (1 + returnPct / 100) } = options;
  return {
    tradeDate: d(day),
    outcomeDate: d(day + 1),
    code: String(1000 + index),
    name: "テスト銘柄" + index,
    aiPower, entryPrice, outcomePrice, sampledAt: "2026-01-02T06:15:00Z",
  };
}

test("empty and not-yet-settled history never qualifies", () => {
  const empty = analyzePrecloseStudy([], d(50));
  assert.equal(empty.phase, "COLLECTING");
  assert.deepEqual(empty.verifiedCandidates, []);
  const rows = Array.from({ length: 5 }, (_, day) => Array.from({length:30},
    (_, index) => observation(day, index, {outcomePrice: null}))).flat();
  const result = analyzePrecloseStudy(rows, d(50));
  assert.equal(result.phase, "COLLECTING");
  assert.equal(result.settled, 0);
  assert.equal(result.validation.samples, 0);
});

test("fixed conditions demand distinct days and chronological out-of-sample validation", () => {
  // Every separate observation day has both policy matches and baseline rows.
  const rows = Array.from({length:40}, (_, day) =>
    Array.from({length:30}, (_, index) => observation(day, index))).flat();
  const today = observation(40, 0, { outcomePrice: null });
  const study = analyzePrecloseStudy([...rows, today], d(40));
  assert.equal(study.phase, "REFERENCE_PASSED");
  assert.equal(study.availableDays, 40);
  assert.equal(study.training.observedDays, 30);
  assert.equal(study.validation.observedDays, 10);
  assert.equal(study.validation.samples, 150);
  assert.equal(study.verifiedCandidates.length, 1);
  assert.equal(study.researchCandidates.length, 1);
  assert.ok(study.improvement > PRECLOSE_POLICY.minBenchmarkImprovementPct);

  const poisonedToday = {...today, outcomePrice: 999999};
  const sameCutoff = analyzePrecloseStudy([...rows, poisonedToday], d(40));
  assert.deepEqual(sameCutoff.validation, study.validation);
  assert.deepEqual(sameCutoff.training, study.training);
  assert.deepEqual(sameCutoff.verifiedCandidates, [poisonedToday]);
});

test("even enough samples cannot pass a losing holdout", () => {
  const rows = Array.from({length:40}, (_, day) =>
    Array.from({length:30}, (_, index) =>
      observation(day, index, day >= 30 && index < 15
        ? {returnPct: -5} : {}))).flat();
  const result = analyzePrecloseStudy([...rows, observation(40, 0)], d(40));
  assert.equal(result.phase, "NOT_PASSED");
  assert.deepEqual(result.verifiedCandidates, []);
  assert.equal(result.validation.winRate, 0);
});

test("pre-policy snapshots never count toward verified condition", () => {
  const archival = Array.from({length:40}, (_, day) =>
    Array.from({length:30}, (_, index) => ({
      ...observation(day, index),
      tradeDate: new Date(Date.UTC(2026, 7, day + 1)).toISOString().slice(0, 10),
      outcomeDate: new Date(Date.UTC(2026, 7, day + 2)).toISOString().slice(0, 10),
    }))).flat();
  const result = analyzePrecloseStudy([...archival, observation(40, 0)], d(40));
  assert.equal(result.availableDays, 0);
  assert.equal(result.phase, "COLLECTING");
  assert.equal(result.verifiedCandidates.length, 0);
  assert.equal(result.history.length, 30);
});

test("100-share PNL, hold denominator and empty statistics are defined", () => {
  const sample = [
    observation(1, 0, {returnPct: 3}),
    observation(1, 1, {returnPct: -3}),
    observation(1, 2, {returnPct: 0.5}),
    observation(1, 3, {outcomePrice: null}),
  ];
  const stats = statsForPreclose(sample);
  assert.equal(stats.samples, 3);
  assert.equal(stats.wins, 1);
  assert.equal(stats.losses, 1);
  assert.equal(stats.holds, 1);
  assert.equal(stats.winRate, 50);
  assert.ok(Math.abs(stats.meanPnl100 - 166.66666666666666) < 0.001);
  assert.equal(stats.worstChangePct, -3);
  assert.equal(statsForPreclose([]).winRate, null);
});

test("page is restricted to one configured owner and has no trade, data, or notification writes", () => {
  const page = readFileSync("app/admin/preclose-candidates/page.tsx", "utf8");
  const hub = readFileSync("app/admin/learning-hub/page.tsx", "utf8");
  const lib = readFileSync("app/lib/research/precloseCandidateStudy.ts", "utf8");
  assert.match(page, /getLearningOwnerSession\(\)/);
  assert.match(page, /if \(!isOwner\) notFound\(\)/);
  assert.match(page, /force-dynamic/);
  assert.match(page, /WHERE o\.time_slot = '15:15'/);
  assert.match(page, /public\.golden_zone_observations/);
  assert.match(page, /public\.daily_stock_results/);
  assert.match(page, /15:15実証候補/);
  assert.match(hub, /href: "\/admin\/preclose-candidates"/);
  for (const [name, source] of [["page", page], ["model", lib]]) {
    assert.doesNotMatch(source, /\b(INSERT INTO|UPDATE public|DELETE FROM|runScan\(|sendNotification\(|pushWebToAll\(|saveDisplaySnapshot\()/i,
      name + " must remain a read-only research surface");
  }
});
