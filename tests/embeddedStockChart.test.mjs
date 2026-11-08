import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(join(root, "app/analysis/[code]/page.tsx"), "utf8");
const embed = readFileSync(join(root, "app/components/analysis/EmbeddedTradingChart.tsx"), "utf8");
const original = readFileSync(join(root, "app/chart/[code]/page.tsx"), "utf8");

test("overview shows permanent stop/profit before optional daily reference chart", () => {
  const start = page.indexOf('id="stock-panel-overview"');
  const end = page.indexOf('id="stock-panel-chart"', start);
  const overview = page.slice(start, end);
  const swing = overview.indexOf("<SwingEntryCard");
  const profit = overview.indexOf("💰 利益とリスク");
  const stop = overview.indexOf("仮の損切価格");
  const guide = overview.indexOf("<AnalysisVisualGuide code={signal.code}");
  assert.ok(swing >= 0 && swing < profit && profit < stop && stop < guide);
  assert.match(overview, /<div className="mt-2 grid grid-cols-1 gap-2">/);
  assert.match(overview, /compact \/>/);
  assert.doesNotMatch(overview.slice(0, guide), /<AnalysisVisualGuide/);
});

test("chart tab begins with full chart link, then real in-page interactive chart", () => {
  const start = page.indexOf('id="stock-panel-chart"');
  const end = page.indexOf('id="stock-panel-analysis"', start);
  const panel = page.slice(start, end);
  const link = panel.indexOf('<Link href={`/chart/${signal.code}`}');
  const full = panel.indexOf("<EmbeddedTradingChart");
  const guide = panel.indexOf("📘 確定日足の目印と読み方も確認する");
  assert.ok(link >= 0 && link < full && full < guide);
  assert.match(panel, /showReferenceChart && \(/);
  assert.match(panel, /aria-expanded=\{showReferenceChart\}/);
  assert.match(panel, /referenceTakeProfit=\{hasReferencePrice \? takeProfit : null\}/);
  assert.match(panel, /referenceStopLoss=\{hasReferencePrice \? stopLoss : null\}/);
});

test("embedded chart reuses production TradingChart with all 6 intervals", () => {
  assert.match(embed, /import TradingChart from "@\/app\/chart\/\[code\]\/components\/TradingChart"/);
  assert.match(original, /import TradingChart from "\.\/components\/TradingChart"/);
  for (const timeframe of ['"5m"', '"15m"', '"1H"', '"1D"', '"1W"', '"1M"']) {
    assert.ok(embed.includes(timeframe), timeframe);
  }
  assert.match(embed, /role="tablist" aria-label="チャートの時間足"/);
  assert.match(embed, /aria-selected=\{timeframe === item\.value\}/);
  assert.match(embed, /<TradingChart/);
  for (const value of ["candles={chart.candles}", "supportPrice={chart.supportPrice ?? null}",
    "resistancePrice={chart.resistancePrice ?? null}", "macd={chart.macd ?? null}",
    "vwap={chart.vwap ?? null}"]) {
    assert.ok(embed.includes(value), value);
  }
});

test("embedded chart fetches real API, protects request races, and discloses quote age", () => {
  assert.match(embed, /\/api\/chart\/\$\{encodeURIComponent\(code\)\}\?tf=\$\{timeframe\}/);
  assert.match(embed, /cache: "no-store"/);
  assert.match(embed, /new AbortController\(\)/);
  assert.match(embed, /controller\.abort\(\)/);
  assert.match(embed, /filter\(validCandle\)/);
  assert.match(embed, /if \(!candles\.length\)/);
  assert.match(embed, /リアルタイムの約定価格ではありません/);
  assert.match(embed, /前回参考値/);
  assert.match(embed, /最終足：/);
  assert.match(embed, /価格データが不足しています/);
  assert.doesNotMatch(embed, /Math\.random|mockCandles|fakeCandles|fetch\("https?:\/\//);
});
