import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("個別チャートは1000銘柄スキャンに依存しない", async () => {
  const source = await read("app/chart/[code]/page.tsx");
  assert.doesNotMatch(source, /api\/scan\?limit=1000/);
  assert.match(source, /api\/scan\/stock\/\$\{code\}/);
  assert.doesNotMatch(source, /stockLoading \|\| \(chartLoading/);
});

test("3 APIは永続スナップショットと状態を使用する", async () => {
  const [scan, market, chart, migration] = await Promise.all([
    read("app/api/scan/route.ts"),
    read("app/api/today-market/route.ts"),
    read("app/api/chart/[symbol]/route.ts"),
    read("scripts/migrations/20260813_create_display_snapshots.sql"),
  ]);
  assert.match(scan, /getLatestScanSnapshot/);
  assert.match(scan, /status: "loading"/);
  assert.match(market, /hotCount: null/);
  assert.match(market, /status: "loading"/);
  assert.match(chart, /getDisplaySnapshot/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.display_snapshots/);
});

test("更新処理は共有DBロックで多重起動を防止する", async () => {
  const source = await read("app/lib/displaySnapshot.ts");
  assert.match(source, /cron_execution_locks/);
  assert.match(source, /ON CONFLICT \(lock_key\) DO UPDATE/);
  assert.match(source, /memoryRefreshes/);
});
