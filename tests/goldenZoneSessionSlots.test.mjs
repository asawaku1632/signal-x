import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const expected = [
  ["0915", "09:15", "19 0 * * 1-5"],
  ["0930", "09:30", "34 0 * * 1-5"],
  ["1030", "10:30", "34 1 * * 1-5"],
  ["1240", "12:40", "44 3 * * 1-5"],
  ["1300", "13:00", "4 4 * * 1-5"],
  ["1430", "14:30", "34 5 * * 1-5"],
  ["1515", "15:15", "19 6 * * 1-5"],
];

test("seven observation slots are mapped consistently across route, runner and DB", () => {
  const cronRoute = read("app/api/cron/golden-zone/route.ts");
  const runner = read("signalx-notification-runner/api/run.js");
  const schedule = JSON.parse(read("signalx-notification-runner/vercel.json")).crons;
  const migration = read("supabase/migrations/20261012_expand_golden_zone_session_slots.sql");
  const page = read("app/admin/golden-zone/page.tsx");
  for (const [key, label, utcSchedule] of expected) {
    assert.ok(cronRoute.includes(`"${key}": { label: "${label}"`), label);
    assert.ok(runner.includes(`"golden-zone-${key}": "/api/cron/golden-zone?slot=${key}"`), label);
    assert.ok(schedule.some((entry) =>
      entry.path === `/api/run?job=golden-zone-${key}` && entry.schedule === utcSchedule
    ), label);
    assert.ok(migration.includes(`'${label}'`), label);
    assert.ok(page.includes(`"${label}"`), label);
  }
  // One dedicated forward-shadow job intentionally runs twice per day.
  // Every other notification/observation route must still be unique.
  const independent = schedule.filter((cron) => cron.path !== "/api/run?job=ema-forward-shadow");
  assert.equal(new Set(independent.map((cron) => cron.path)).size, independent.length);
  const forward = schedule.filter((cron) => cron.path === "/api/run?job=ema-forward-shadow");
  assert.deepEqual(forward.map((cron) => cron.schedule).sort(), [
    "10 8 * * 1-5",
    "10 9 * * 1-5",
  ]);
  assert.equal(new Set(schedule.map((cron) => cron.path + "|" + cron.schedule)).size, schedule.length);
});

test("observation remains admin/cron isolated and does not trigger market scan", () => {
  const route = read("app/api/cron/golden-zone/route.ts");
  const page = read("app/admin/golden-zone/page.tsx");
  assert.match(route, /requireCronAuth\(request\)/);
  assert.match(route, /getLatestScanSnapshot\(\)/);
  assert.match(route, /MAX_SCAN_AGE_MS/);
  assert.match(route, /ON CONFLICT \(trade_date, time_slot, code\) DO NOTHING/);
  assert.doesNotMatch(route, /\brunScan\(|\brunSingleStockScan\(|\brefreshScanSnapshot\(/);
  assert.match(page, /getAdminSession\(\)/);
  assert.match(page, /if \(!isAdmin\)/);
});
