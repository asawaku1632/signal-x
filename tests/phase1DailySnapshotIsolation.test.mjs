import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  minimumDailyScanCount,
  validateDailyScanCoverage,
} from "../app/lib/learning/dailyScanGuard.ts";
import { shouldReplaceSnapshot } from "../app/lib/learning/snapshotCoverage.ts";

const read = (file) => readFileSync(file, "utf8");

test("表示用20件と全銘柄scanは別snapshot keyを使う", () => {
  const snapshot = read("app/lib/scanSnapshot.ts");
  const todayMarket = read("app/api/today-market/route.ts");
  assert.match(snapshot, /SCAN_SNAPSHOT_KEY = "scan:latest"/);
  assert.match(snapshot, /TODAY_MARKET_SCAN_SNAPSHOT_KEY = "scan:today-market"/);
  assert.match(todayMarket, /refreshTodayMarketScanSnapshot\(20\)/);
  assert.doesNotMatch(todayMarket, /refreshScanSnapshot\(20\)/);
});

test("20件表示用refresh後でもlimit=1000は小さいsnapshotを返さない", () => {
  const scanRoute = read("app/api/scan/route.ts");
  assert.match(scanRoute, /blockingConsumer && !responseCoversRequest/);
  assert.match(scanRoute, /insufficient_snapshot_coverage/);
  assert.match(scanRoute, /status: 503/);
});

test("小さいsnapshotは大きいsnapshotを上書きしない", () => {
  assert.equal(shouldReplaceSnapshot(null, 20), true);
  assert.equal(shouldReplaceSnapshot(20, 960), true);
  assert.equal(shouldReplaceSnapshot(960, 20), false);
  assert.equal(shouldReplaceSnapshot(960, 960), true);
});

test("日次保存20件は失敗し、通常の960件前後は許可する", () => {
  assert.equal(minimumDailyScanCount(966), 773);
  assert.equal(validateDailyScanCoverage(20, 966).valid, false);
  assert.equal(validateDailyScanCoverage(960, 966).valid, true);
  assert.equal(validateDailyScanCoverage(966, 966).valid, true);

  const saveDaily = read("app/api/learning/save-daily/route.ts");
  assert.match(saveDaily, /existing daily snapshot coverage is insufficient/);
  assert.match(saveDaily, /daily scan coverage is insufficient/);
});

test("判定Runnerは価格JOIN不能残件を検知しCronが監査ログを残す", () => {
  const runner = read("app/lib/learning/checkDailyRunner.ts");
  const cron = read("app/api/cron/check-daily/route.ts");
  assert.match(runner, /incomplete_price_coverage/);
  assert.match(runner, /report\.remainingCount > 0/);
  assert.match(runner, /report\.comparableRemainingCount === 0/);
  assert.match(cron, /saveCronRunLog/);
  assert.match(cron, /details: report/);
});

test("Phase 1の非blocking consumerはafter refreshを維持する", () => {
  const scanRoute = read("app/api/scan/route.ts");
  const todayMarket = read("app/api/today-market/route.ts");
  assert.match(scanRoute, /if \(!blockingConsumer/);
  assert.match(scanRoute, /after\(async \(\) =>/);
  assert.match(todayMarket, /after\(async \(\) =>/);
});

test("Phase 2の並列化・一括化コードには変更を要求しない", () => {
  assert.match(read("app/lib/learning/scanEngine.ts"), /SCAN_CONCURRENCY = 20/);
  assert.match(read("app/lib/learning/promisePool.ts"), /allSettledWithConcurrency/);
  assert.match(read("app/lib/similarExperience.ts"), /LATERAL/);
  assert.match(read("app/lib/experienceRanking.ts"), /LATERAL/);
});
