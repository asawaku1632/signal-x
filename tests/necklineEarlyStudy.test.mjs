import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeNecklineTimeline } from "../app/lib/research/necklineEarlyStudy.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function sample() {
  const bars = Array.from({ length: 44 }, (_, i) => ({
    time: 1700000000 + i * 86400, open: 98, high: 100, low: 97, close: 98, volume: 1000,
  }));
  bars[10] = { ...bars[10], low: 90, close: 95 };
  bars[17] = { ...bars[17], high: 105, close: 102 };
  bars[24] = { ...bars[24], low: 91, close: 92 };
  bars[25] = { ...bars[25], low: 92, close: 94 };
  bars[26] = { ...bars[26], low: 93, close: 98 };
  bars[33] = { ...bars[33], high: 109, close: 108, volume: 2500 };
  return bars;
}

test("a pivot cannot be identified until two complete right-hand days; then seven sessions lead", () => {
  assert.equal(analyzeNecklineTimeline(sample().slice(0,26)).totalCandidates, 0);
  const day26 = analyzeNecklineTimeline(sample().slice(0,27));
  assert.equal(day26.totalCandidates, 1);
  assert.equal(day26.latest.firstSeenIndex, 26);
  assert.equal(day26.latest.breakoutIndex, null);
  const full = analyzeNecklineTimeline(sample());
  assert.equal(full.latest.firstSeenIndex, 26);
  assert.equal(full.latest.breakoutIndex, 33);
  assert.equal(full.latest.leadSessions, 7);
  assert.equal(full.latest.neckline, 105);
  assert.equal(full.latest.breakoutVolumeRatio, 2.5);
  assert.equal(full.leadSevenCount, 1);
  assert.equal(full.pairedSevenEarly5.n, 1);
  assert.equal(full.pairedSevenBreakout5.n, 1);
});

test("later prices cannot alter an earlier initial detection or candidate neckline", () => {
  const bars = sample(), original = analyzeNecklineTimeline(bars);
  const change = sample();
  change[40] = { ...change[40], high: 300, close: 150 };
  const later = analyzeNecklineTimeline(change);
  assert.equal(later.events[0].firstSeenIndex, original.events[0].firstSeenIndex);
  assert.equal(later.events[0].neckline, original.events[0].neckline);
  assert.equal(analyzeNecklineTimeline(bars.slice(0,34)).latest.breakoutIndex, 33);
});

test("candidates that fail do not disappear from early cohort or become fake breakouts", () => {
  const bars = sample();
  bars[33] = { ...bars[33], open: 93, high: 98, low: 88, close: 89, volume: 1000 };
  const result = analyzeNecklineTimeline(bars);
  assert.equal(result.totalCandidates, 1);
  assert.equal(result.latest.status, "INVALIDATED");
  assert.equal(result.totalBreakouts, 0);
  assert.equal(result.early5.n, 1);
  assert.equal(result.breakout5, null);
});

test("invalid, duplicate, unsorted and insufficient prices must fail closed", () => {
  const bars = sample();
  assert.equal(analyzeNecklineTimeline(bars.slice(0,24)).dataValid, false);
  assert.equal(analyzeNecklineTimeline([...bars.slice(0,2), bars[1], ...bars.slice(2)]).dataValid, false);
  assert.equal(analyzeNecklineTimeline([...bars].reverse()).dataValid, false);
  assert.equal(analyzeNecklineTimeline([{ ...bars[0], low: 110 }, ...bars.slice(1)]).dataValid, false);
});

test("study is linked to completed daily chart and does not alter buying or notification code", () => {
  const guide=readFileSync(join(root,"app/components/analysis/AnalysisVisualGuide.tsx"),"utf8");
  const panel=readFileSync(join(root,"app/components/analysis/NecklineEarlyStudyPanel.tsx"),"utf8");
  assert.match(guide,/chart\.kind === "ready" && \(/);
  assert.match(guide,/<NecklineEarlyStudyPanel candles=\{candles\} usable=\{!insufficient\}/);
  assert.match(panel,/往復費用を一律0\.2%/);
  assert.match(panel,/通知・発注・本番のAI判定には接続しません/);
  assert.match(panel,/選択バイアス/);
});
