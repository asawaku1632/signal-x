import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { analyzeEmaCrossovers, backtestEmaCrossovers } from "../app/lib/emaCrossoverBacktest.ts";

function bars(closes, openAdjustments = {}) {
  return closes.map((close, i) => ({
    time: 1700000000 + i * 86400,
    open: close + (openAdjustments[i] ?? 2),
    high: close + 15,
    low: close - 15,
    close,
    volume: 1000,
  }));
}

const fullCycle = () => bars([
  ...Array(30).fill(100),
  ...Array.from({ length: 30 }, (_, i) => 100 + 4 * (i + 1)),
  ...Array.from({ length: 35 }, (_, i) => 220 - 5 * (i + 1)),
]);

test("買い・売りはクロス成立日ではなく次の足の始値で約定する", () => {
  const candles = fullCycle();
  const signals = analyzeEmaCrossovers(candles).signals;
  const result = backtestEmaCrossovers(candles);
  assert.ok(signals.some((s) => s.kind === "BUY"));
  assert.ok(signals.some((s) => s.kind === "SELL"));
  assert.equal(result.trades.length, 1);
  const buy = signals.find((s) => s.kind === "BUY");
  const sell = signals.find((s) => s.kind === "SELL");
  const trade = result.trades[0];
  assert.equal(trade.entryTime, candles[buy.index + 1].time);
  assert.equal(trade.entryPrice, candles[buy.index + 1].open);
  assert.equal(trade.exitTime, candles[sell.index + 1].time);
  assert.equal(trade.exitPrice, candles[sell.index + 1].open);
  assert.equal(trade.pnlYen, Number(((trade.exitPrice - trade.entryPrice) * 100).toFixed(2)));
  assert.equal(result.stats.closedTrades, 1);
  assert.equal(result.openPosition, null);
});

test("同日終値で仮想約定しない: 翌日のギャップを損益に反映", () => {
  const base = fullCycle();
  const signals = analyzeEmaCrossovers(base).signals;
  const buyIndex = signals.find((s) => s.kind === "BUY").index;
  const sellIndex = signals.find((s) => s.kind === "SELL").index;
  const candles = base.map((b) => ({ ...b }));
  candles[buyIndex + 1].open += 20;
  candles[sellIndex + 1].open -= 15;
  const original = backtestEmaCrossovers(base);
  const changed = backtestEmaCrossovers(candles);
  assert.equal(changed.trades[0].pnlYen, original.trades[0].pnlYen - 3500);
  assert.deepEqual(analyzeEmaCrossovers(base).signals, analyzeEmaCrossovers(candles).signals);
});

test("未確定の買いクロスは取引件数・含み損益に含めない", () => {
  const candles = bars([...Array(30).fill(100), ...Array.from({ length: 15 }, (_, i) => 100 + (i + 1) * 3)]);
  const signal = analyzeEmaCrossovers(candles).signals.find((s) => s.kind === "BUY");
  assert.ok(signal);
  const result = backtestEmaCrossovers(candles.slice(0, signal.index + 1));
  assert.equal(result.pendingBuy, true);
  assert.equal(result.openPosition, null);
  assert.equal(result.stats.closedTrades, 0);
  assert.equal(result.stats.winRatePercent, null);
});

test("売りクロス後の翌足未到来は確定損益に入れず保有中に残す", () => {
  const all = fullCycle();
  const signal = analyzeEmaCrossovers(all).signals.find((s) => s.kind === "SELL");
  assert.ok(signal);
  const result = backtestEmaCrossovers(all.slice(0, signal.index + 1));
  assert.equal(result.trades.length, 0);
  assert.equal(result.stats.totalPnlYen, 0);
  assert.equal(result.openPosition?.exitPending, true);
});

test("未決済は別表示・同一期間でも株数比例し、集計に混在しない", () => {
  const candles = bars([...Array(30).fill(100), ...Array.from({ length: 30 }, (_, i) => 100 + 4 * (i + 1))]);
  const a = backtestEmaCrossovers(candles);
  const b = backtestEmaCrossovers(candles, 200);
  assert.equal(a.trades.length, 0);
  assert.ok(a.openPosition);
  assert.equal(a.openPosition.unrealizedPnlYen * 2, b.openPosition.unrealizedPnlYen);
  assert.throws(() => backtestEmaCrossovers(candles, 0), /INVALID_SHARE_COUNT/);
});

test("EMA成立に必要な確定足がない場合は判定や損益を捏造しない", () => {
  const result = backtestEmaCrossovers(bars(Array(20).fill(100)));
  assert.equal(result.trades.length, 0);
  assert.equal(result.stats.closedTrades, 0);
  assert.equal(result.openPosition, null);
});

test("管理者限定・取得のみ、保存と通知に影響しない", () => {
  const api = readFileSync("app/api/admin/ema-signals/route.ts", "utf8");
  const page = readFileSync("app/admin/ema-signals/EmaSignalWorkbench.tsx", "utf8");
  const engine = readFileSync("app/lib/emaCrossoverBacktest.ts", "utf8");
  assert.match(api, /getAdminSession/);
  assert.match(api, /if \(!isAdmin\)/);
  assert.match(api, /Cache-Control.*private, no-store/);
  assert.match(page, /backtestEmaCrossovers/);
  assert.match(page, /確定取引の勝率/);
  assert.match(api, /range=.+interval=1d/);
  assert.doesNotMatch(engine + page + api, /\bINSERT\b|\bUPDATE\b|\bDELETE\b|sendNotification|pool\.query|saveDisplaySnapshot/);
});
