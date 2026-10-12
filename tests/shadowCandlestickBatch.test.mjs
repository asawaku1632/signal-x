import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  MAX_SHADOW_BATCH_STOCKS,
  parseShadowBatchCodes,
  studyShadowCandleBatch,
} from "../app/lib/research/shadowCandlestickBatch.ts";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const baseTime = 1780000000;
function bar(i, open, close, high = Math.max(open, close) + 1, low = Math.min(open, close) - 1) {
  return { time: baseTime + i * 86400, open, close, high, low };
}
function downtrend() {
  return Array.from({ length: 12 }, (_, i) => {
    const close = 125 - 2 * i;
    return bar(i, close + 0.5, close);
  });
}
function bullEngulfingWithFuture(outcomes = []) {
  const rows = [...downtrend(), bar(12, 101, 97), bar(13, 96, 102)];
  outcomes.forEach((close, i) => rows.push(bar(i + 14, close - 0.3, close)));
  return rows;
}

test("requests accept no more than five unique, syntactically safe tickers", () => {
  assert.equal(MAX_SHADOW_BATCH_STOCKS, 5);
  assert.deepEqual(parseShadowBatchCodes("3182,3387 6855、7203,9984"), {
    codes: ["3182", "3387", "6855", "7203", "9984"], error: null,
  });
  assert.equal(parseShadowBatchCodes("3182,3182").codes.length, 0);
  assert.match(parseShadowBatchCodes("3182,3182").error, /重複/);
  assert.match(parseShadowBatchCodes("3182,3387,6855,7203,9984,8058").error, /最大5銘柄/);
  assert.match(parseShadowBatchCodes("3182,http://evil.invalid").error, /英数字/);
  assert.deepEqual(parseShadowBatchCodes(" "), { codes: [], error: null });
});

test("portfolio aggregates events and distinct tickers, not just one stock's win rate", () => {
  const stockA = { code: "3182", candles: bullEngulfingWithFuture([104, 104, 104, 104, 105]) };
  const stockB = { code: "7203", candles: bullEngulfingWithFuture([101, 101, 100, 101, 99]) };
  const report = studyShadowCandleBatch([stockA, stockB]);
  const row = report.rows.find(x => x.id === "SH_CDL_BULL_ENGULF");
  assert.ok(row, "pattern row exists");
  assert.equal(report.stocks.length, 2);
  assert.equal(row.detections, 2);
  assert.equal(row.detectionStockCount, 2);
  for (const h of row.horizons) {
    assert.equal(h.completed, 2);
    assert.equal(h.stockCount, 2);
    assert.equal(h.wins, 1);
    assert.equal(h.winPercent, 50);
    assert.ok(h.worstDirectionalPercent < 0);
    assert.ok(h.bestDirectionalPercent > 0);
  }
  assert.equal(report.totalCompleted5d >= 2, true);
});

test("future rows do not count unless N completed daily bars actually exist", () => {
  const report = studyShadowCandleBatch([
    { code: "3182", candles: bullEngulfingWithFuture([103]) },
    { code: "7203", candles: bullEngulfingWithFuture([101, 101, 101, 101, 101]) },
  ]);
  const row = report.rows.find(x => x.id === "SH_CDL_BULL_ENGULF");
  assert.deepEqual(row.horizons.map(h => h.completed), [2, 1, 1]);
});

test("no data returns no invented performance; no stock can count as a success from empty data", () => {
  const report = studyShadowCandleBatch([]);
  assert.equal(report.totalDetections, 0);
  assert.equal(report.totalCompleted5d, 0);
  assert.equal(report.rows.length, 9);
  for (const row of report.rows) {
    for (const h of row.horizons) {
      assert.equal(h.completed, 0);
      assert.equal(h.winPercent, null);
      assert.equal(h.averageDirectionalPercent, null);
      assert.equal(h.worstDirectionalPercent, null);
    }
  }
});

test("batch page is owner-gated before Yahoo calls, bounded and not auto-running on page open", () => {
  const page = read("app/admin/shadow-candlestick-nine/batch/page.tsx");
  const guard = page.indexOf("if (!isOwner) notFound()");
  const run = page.indexOf("await fetchCohort(parsed.codes)");
  assert.ok(guard > 0 && run > guard);
  assert.match(page, /attempted && !parsed\.error && parsed\.codes\.length/);
  assert.match(page, /const parsed = parseShadowBatchCodes\(input\)/);
  assert.match(page, /Math\.min\(3, codes\.length\)/);
  assert.match(page, /dateJst\(time\) >= cutoff/);
  assert.match(page, /cache: "no-store"/);
  assert.match(page, /途中の最大ドローダウンではありません/);
  assert.doesNotMatch(page, /\b(?:pool\.query|INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|runScan\s*\(|sendLine\s*\()/i);
});

test("research does not alter live prediction, notification or existing 55-pattern detector", () => {
  const main = read("app/lib/chartPatternEngine.ts");
  const scanner = read("app/lib/learning/stockAnalyzer.ts");
  const aggregate = read("app/lib/research/shadowCandlestickBatch.ts");
  assert.doesNotMatch(main, /shadowCandlestickBatch|SH_CDL_/);
  assert.doesNotMatch(scanner, /shadowCandlestickBatch|SH_CDL_/);
  assert.doesNotMatch(aggregate, /\b(?:fetch|pool\.query|INSERT|UPDATE|DELETE|sendLine)\s*\(/i);
  assert.match(read("app/admin/learning-hub/page.tsx"), /href: "\/admin\/shadow-candlestick-nine\/batch"/);
  assert.match(read("app/admin/shadow-candlestick-nine/page.tsx"), /href="\/admin\/shadow-candlestick-nine\/batch" prefetch=\{false\}/);
});
