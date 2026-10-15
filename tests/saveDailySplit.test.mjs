import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const config = JSON.parse(read("vercel.json"));
const daily = read("app/api/learning/save-daily/route.ts");
const post = read("app/api/cron/save-post/route.ts");

test("post-save research phases have distinct weekday JST cron schedules", () => {
  const expected = new Map([
    ["/api/cron/save-post?phase=pattern", "50 6 * * 1-5"],
    ["/api/cron/save-post?phase=reversal", "55 6 * * 1-5"],
    ["/api/cron/save-post?phase=momentum", "0 7 * * 1-5"],
    ["/api/cron/save-post?phase=finalize", "5 7 * * 1-5"],
  ]);
  for (const [path, schedule] of expected) {
    const matches = config.crons.filter((entry) => entry.path === path);
    assert.equal(matches.length, 1, `Expected exactly one entry for ${path}`);
    assert.equal(matches[0].schedule, schedule);
  }
});

test("critical daily save no longer awaits time-heavy date-only enrichment", () => {
  for (const symbol of [
    "updatePatternForwardOutcomes",
    "refreshPatternForwardStats",
    "saveTrendPullbackReversalObservations",
    "saveAiReversalObservations",
    "saveHighAiPullbackObservations",
    "saveMomentumMemoryObservations",
    "refreshMomentumMemoryForwardStats",
    "notifyMomentumMemoryCandidates",
  ]) {
    assert.doesNotMatch(daily, new RegExp(symbol), `Move ${symbol} to the post-save job`);
    assert.match(post, new RegExp(symbol), `Post-save job must retain ${symbol}`);
  }
  assert.match(daily, /await saveDailyStocks\(targetDate, stocks\)/);
  assert.match(daily, /await saveRelatedLearning\(targetDate, stocks\)/);
  assert.match(daily, /await savePatternForwardObservations\(targetDate, stocks\)/);
});

test("post-save research requires a cron secret and snapshot coverage", () => {
  assert.match(post, /process\.env\.CRON_SECRET/);
  assert.match(post, /validateDailyScanCoverage\(snapshotCount/);
  assert.match(post, /cron_execution_locks/);
  assert.match(post, /status: "COMPLETED"/);
});
