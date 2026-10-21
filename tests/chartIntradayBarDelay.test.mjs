import assert from "node:assert/strict";
import test from "node:test";
import { intradayBarDelayMinutes } from "../app/lib/chartIntradayBarDelay.mjs";

const at = (iso) => new Date(iso).getTime();
const bar = (iso) => at(iso) / 1000;

test("same-day five-minute candle delayed by 15 minutes during regular session", () => {
  assert.equal(
    intradayBarDelayMinutes(bar("2026-10-21T09:10:00+09:00"), at("2026-10-21T09:25:00+09:00"), "5m"), 15,
  );
  assert.equal(
    intradayBarDelayMinutes(bar("2026-10-21T09:19:00+09:00"), at("2026-10-21T09:25:00+09:00"), "5m"), null,
  );
  assert.equal(
    intradayBarDelayMinutes(bar("2026-10-21T09:15:00+09:00"), at("2026-10-21T09:25:00+09:00"), "5m"), 10,
  );
});

test("ignore 15m/1H/1D bars, where old candle start times may be normal", () => {
  const now = at("2026-10-21T09:25:00+09:00");
  const timestamp = bar("2026-10-21T09:00:00+09:00");
  for (const tf of ["15m", "1H", "1D", "1W", "1M"]) {
    assert.equal(intradayBarDelayMinutes(timestamp, now, tf), null);
  }
});

test("ignore outside market session (lunch, after-hours, weekends)", () => {
  const timestamp = bar("2026-10-21T11:20:00+09:00");
  assert.equal(intradayBarDelayMinutes(timestamp, at("2026-10-21T12:15:00+09:00"), "5m"), null);
  assert.equal(intradayBarDelayMinutes(timestamp, at("2026-10-21T16:00:00+09:00"), "5m"), null);
  assert.equal(intradayBarDelayMinutes(timestamp, at("2026-10-24T09:25:00+09:00"), "5m"), null);
});

test("missing or prior-day source and negative-clock skew are not intraday delay", () => {
  const now = at("2026-10-21T09:25:00+09:00");
  assert.equal(intradayBarDelayMinutes(undefined, now, "5m"), null);
  assert.equal(intradayBarDelayMinutes(bar("2026-10-20T15:30:00+09:00"), now, "5m"), null);
  assert.equal(intradayBarDelayMinutes(bar("2026-10-21T09:30:00+09:00"), now, "5m"), null);
});

test("chart UI shows stale data and its age instead of presenting an old quote as new", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const page = readFileSync(fileURLToPath(new URL("../app/chart/[code]/page.tsx", import.meta.url)), "utf8");
  assert.match(page, /intradayBarDelayMinutes\(chart\.latestBarTimestamp, nowMs, timeframe\)/);
  assert.match(page, /chart\.status === "stale"\s*\|\|\s*intradayDelayed/);
  assert.match(page, /当日5分足の更新が遅れています/);
  assert.match(page, /約\{delayMinutes\}分前/);
  assert.match(page, /setInterval\(refreshClock, 30_000\)/);
});
