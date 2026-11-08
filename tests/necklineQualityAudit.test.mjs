import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditNecklineQuality,
  NECKLINE_QUALITY_VERSION,
  NECKLINE_ROUND_TRIP_COST_PERCENT,
} from "../app/lib/research/necklineQualityAudit.mjs";

const base = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = path => readFileSync(join(base, path), "utf8");
const now = new Date("2026-11-09T17:00:00+09:00");

function fixture(count = 44) {
  const a = Array.from({ length: count }, (_, i) => ({
    time: 1700000000 + i * 86400, open: 98, high: 100,
    low: 97, close: 98, volume: 1000,
  }));
  a[10] = { ...a[10], low: 90, close: 95 };
  a[17] = { ...a[17], high: 105, close: 102 };
  a[24] = { ...a[24], low: 91, close: 92 };
  a[25] = { ...a[25], low: 92, close: 94 };
  a[26] = { ...a[26], low: 93, close: 98 };
  if (count > 33) a[33] = { ...a[33], high: 109, close: 108, volume: 2500 };
  return a;
}
const s = (code, candles, error=null) => ({code, candles, error});

test("all candidates remain in early cohort, including later failures", () => {
  const good = fixture();
  const failed = fixture();
  failed[33] = { ...failed[33], open: 95, high: 99, low: 80, close: 85 };
  const report = auditNecklineQuality([s("7164", good), s("3774", failed)], now);
  assert.equal(report.version, NECKLINE_QUALITY_VERSION);
  assert.equal(report.costPercentPoints, NECKLINE_ROUND_TRIP_COST_PERCENT);
  assert.equal(report.candidates, 2);
  assert.deepEqual(report.byStatus, {watch:0,breakout:1,invalidated:1,expired:0});
  assert.equal(report.decidedCandidates, 2);
  assert.equal(report.resolvedBreakoutPercent, 50);
  assert.equal(report.early3.completed, 2);
  assert.equal(report.early5.completed, 2);
  assert.equal(report.breakout3.completed, 1);
  assert.equal(report.breakout5.completed, 1);
  assert.ok(report.events.some(e=>e.code==="3774" && e.status==="INVALIDATED"));
  assert.ok(report.events.some(e=>e.code==="7164" && e.status==="BREAKOUT"));
});

test("no future outcomes enter denominators and pending are not counted as failures", () => {
  const partial = fixture(27);
  const report = auditNecklineQuality([s("7164", partial)], now);
  assert.equal(report.candidates, 1);
  assert.equal(report.byStatus.watch, 1);
  assert.equal(report.decidedCandidates, 0);
  assert.equal(report.resolvedBreakoutPercent, null);
  assert.equal(report.early3.completed, 0);
  assert.equal(report.early5.completed, 0);
  assert.equal(report.breakout3.completed, 0);
  assert.equal(report.events[0].firstSeenDate.length, 10);
});

test("invalid data and upstream errors are strictly excluded, not silently shortened", () => {
  const sample = fixture();
  const invalid = [...sample];
  invalid[23] = {...invalid[23], high: 1};
  const report = auditNecklineQuality([
    s("7164",sample),
    s("3774",invalid),
    s("5929",[], "データ取得失敗"),
    s("7752",sample.slice(0,15)),
  ],now);
  assert.equal(report.requestedSymbols, 4);
  assert.equal(report.usableSymbols, 1);
  assert.equal(report.excludedSymbols, 3);
  assert.equal(report.details.filter(x=>x.status==="EXCLUDED").length, 3);
  assert.equal(report.candidates, 1);
  assert.throws(()=>auditNecklineQuality([s("7164",sample),s("7164",sample)],now));
  assert.throws(()=>auditNecklineQuality([s("7164",sample),s("3774",sample),s("5929",sample),s("7752",sample),s("4331",sample),s("0001",sample)],now));
});

test("stale historical prices must be described as replay, not real-time detection or signal", () => {
  const report=auditNecklineQuality([s("7164",fixture())],now);
  assert.equal(report.replayOnly,true);
  assert.match(report.source,/YAHOO_CHART_1D_READONLY/);
  assert.ok(report.latestDate < "2026-11-09");
  assert.equal(report.events[0].breakoutDate.length, 10);
  const page=load("app/admin/neckline-quality/page.tsx");
  const hub=load("app/admin/learning-hub/page.tsx");
  assert.match(page,/getLearningOwnerSession/);
  assert.match(page,/if \(!isOwner\) notFound\(\)/);
  assert.match(page,/fetchCohort\(codes\)/);
  assert.match(page,/const run = params\.run === "1"/);
  assert.match(page,/codes\.length > 5/);
  assert.match(page,/新しい候補から最大50件/);
  assert.match(page,/事前固定のFORWARD成績ではありません/);
  assert.match(page,/失効・期限終了を「形の誤検出」と断定はできません/);
  assert.match(hub,/href: "\/admin\/neckline-quality"/);
  assert.doesNotMatch(page,/pool\.|INSERT INTO|UPDATE public\.|sendNotification|pushNotification|cron/);
});
