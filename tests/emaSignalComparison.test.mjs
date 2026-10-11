import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { analyzeEmaCrossovers, backtestEmaCrossovers } from "../app/lib/emaCrossoverBacktest.ts";
import { compareEmaVariants, volumeEntryAllowed, bollingerEntryAllowed, EMA_VARIANT_IDS } from "../app/lib/emaSignalComparison.ts";

function bars(closes, volumes = []) {
  return closes.map((close, i) => ({ time: 1700000000 + i * 86400, open: close + 2, close, high: close + 3, low: close - 3, volume: volumes[i] ?? 1000 }));
}
const sample = () => bars([
  ...Array(30).fill(100),
  ...Array.from({length:30}, (_, i) => 100 + 4 * (i + 1)),
  ...Array.from({length:35}, (_, i) => 220 - 5 * (i + 1)),
]);

test("unfiltered strategy remains exactly the previous backtest", () => {
  const candles = sample();
  assert.deepEqual(compareEmaVariants(candles).BASE, backtestEmaCrossovers(candles));
  assert.deepEqual(EMA_VARIANT_IDS, ["BASE", "VOLUME", "BOLLINGER"]);
});

test("volume condition uses previous 20 bars, not the future bar", () => {
  const candles = bars(Array(28).fill(100));
  assert.equal(volumeEntryAllowed(candles, 19), false);
  assert.equal(volumeEntryAllowed(candles, 20), false);
  candles[20].volume = 1500;
  assert.equal(volumeEntryAllowed(candles, 20), true);
  candles[21].volume = 1500;
  assert.equal(volumeEntryAllowed(candles, 21), false); // prev 20 include day20's higher volume
  candles[27].volume = 300000;
  assert.equal(volumeEntryAllowed(candles, 20), true); // future volume never used
  candles[21].volume = 0;
  assert.equal(volumeEntryAllowed(candles, 21), false);
});

test("BB rule only uses closes up to signal day, rejects upper-band overheating", () => {
  const candles = bars([...Array(19).fill(100), 100, 120, 99]);
  assert.equal(bollingerEntryAllowed(candles, 18), false);
  assert.equal(bollingerEntryAllowed(candles, 19), false);
  assert.equal(bollingerEntryAllowed(candles, 20), false); // 120 is above 2sigma
  candles[21].close = 101;
  assert.equal(bollingerEntryAllowed(candles, 21), true);
  const original = bollingerEntryAllowed(candles, 21);
  candles.push(...bars(Array(40).fill(500)));
  assert.equal(bollingerEntryAllowed(candles, 21), original);
});

test("volume filter skips entries when crossover signal has no volume confirmation, without creating phantom exits", () => {
  const candles = sample();
  const signals = analyzeEmaCrossovers(candles).signals;
  const buy = signals.find((s) => s.kind === "BUY");
  assert.ok(buy);
  assert.equal(volumeEntryAllowed(candles, buy.index), false);
  const out = compareEmaVariants(candles);
  assert.ok(out.BASE.trades.length > 0);
  assert.equal(out.VOLUME.trades.length, 0);
  assert.equal(out.VOLUME.stats.winRatePercent, null);
  assert.equal(out.VOLUME.stats.totalPnlYen, 0);
  const modified = candles.map((x) => ({...x}));
  modified[buy.index].volume = 3000;
  assert.deepEqual(compareEmaVariants(modified).VOLUME.trades, backtestEmaCrossovers(modified).trades);
});

test("all variants execute on next opening price, never cross-day close; no persistence or notifications", () => {
  const candles = sample();
  const out = compareEmaVariants(candles);
  for (const key of EMA_VARIANT_IDS) {
    for (const trade of out[key].trades) {
      const entry = candles.findIndex((c) => c.time === trade.entryTime);
      const exit = candles.findIndex((c) => c.time === trade.exitTime);
      assert.equal(trade.entryPrice, candles[entry].open);
      assert.equal(trade.exitPrice, candles[exit].open);
      assert.ok(entry > candles.findIndex((c) => c.time === trade.buySignalTime));
      assert.ok(exit > candles.findIndex((c) => c.time === trade.sellSignalTime));
    }
  }
  const src = readFileSync("app/admin/ema-comparison/EmaComparisonClient.tsx", "utf8");
  const lib = readFileSync("app/lib/emaSignalComparison.ts", "utf8");
  assert.doesNotMatch(src + lib, /pool\.query|INSERT INTO|UPDATE public|DELETE FROM|sendNotification|sendLine/i);
  assert.match(src, /\/api\/admin\/ema-signals/);
  const gate = readFileSync("app/admin/ema-comparison/page.tsx", "utf8");
  assert.match(gate, /getAdminSession/);
  assert.match(gate, /if \(!isAdmin\)/);
});
