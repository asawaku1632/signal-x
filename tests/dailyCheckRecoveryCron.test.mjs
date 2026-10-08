import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("daily checking gets three separate once-daily weekday cron jobs", () => {
  const config = JSON.parse(read("vercel.json"));
  const jobs = config.crons.filter((job) =>
    job.path.startsWith("/api/cron/check-daily"),
  );
  assert.deepEqual(
    jobs.map(({ path, schedule }) => ({ path, schedule })),
    [
      { path: "/api/cron/check-daily", schedule: "50 6 * * 1-5" },
      { path: "/api/cron/check-daily-recovery", schedule: "30 7 * * 1-5" },
      { path: "/api/cron/check-daily-recovery-late", schedule: "30 8 * * 1-5" },
    ],
  );
  assert.equal(new Set(jobs.map((job) => job.path)).size, 3);
});

test("each recovery route has distinct audit log route and bounded duration", () => {
  for (const suffix of ["check-daily-recovery", "check-daily-recovery-late"]) {
    const route = read(`app/api/cron/${suffix}/route.ts`);
    assert.match(route, /runDailyCheckRecovery/);
    assert.match(route, /maxDuration = 60/);
    assert.ok(route.includes(`"/api/cron/${suffix}"`));
  }
});

test("recovery uses same authorization, advisory lock and UNKNOWN-only update", () => {
  const recovery = read("app/lib/learning/dailyCheckRecoveryCron.ts");
  const runner = read("app/lib/learning/checkDailyRunner.ts");
  assert.match(recovery, /isCronAuthorized\(request\)/);
  assert.match(recovery, /process\.env\.CRON_SECRET/);
  assert.match(recovery, /runDailyCheck\(\{/);
  assert.match(recovery, /maxBatches: MAX_DAILY_CHECK_BATCHES/);
  assert.match(recovery, /details: report/);
  assert.match(runner, /pg_try_advisory_xact_lock/);
  assert.match(runner, /daily\.result = 'UNKNOWN'/);
  assert.match(runner, /UPDATE experience_learning_logs/);
});

test("recovery reports unfinished batches without treating them as fully done", () => {
  const recovery = read("app/lib/learning/dailyCheckRecoveryCron.ts");
  assert.match(recovery, /stopReason === "max_batches"/);
  assert.match(recovery, /stopReason === "time_budget"/);
  assert.match(recovery, /pending work may remain/);
  assert.match(recovery, /incomplete_price_coverage/);
});
