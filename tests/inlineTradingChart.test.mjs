import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const detail = readFileSync(join(root, "app/analysis/[code]/page.tsx"), "utf8");
const inline = readFileSync(join(root, "app/components/analysis/InlineTradingChart.tsx"), "utf8");

test("overview prioritizes P/L ahead of compact candle guide", () => {
  const start = detail.indexOf('id="stock-panel-overview"');
  const end = detail.indexOf('id="stock-panel-chart"', start);
  assert.ok(start >= 0 && end > start);
  const panel = detail.slice(start, end);
  const swing = panel.indexOf("<SwingEntryCard");
  const profit = panel.indexOf("💰 利益とリスク");
  const stopLoss = panel.indexOf("仮の損切価格");
  const compact = panel.indexOf("<AnalysisVisualGuide");
  assert.ok(swing >= 0 && swing < profit && profit < stopLoss && stopLoss < compact);
  assert.match(panel, /<div className="mt-2 grid grid-cols-1 gap-2">/);
  assert.doesNotMatch(panel.slice(swing, compact), /<details open=\{swingEntryDecision/);
});

test("chart tab opens the full interactive chart without a duplicate blue link", () => {
  const start = detail.indexOf('id="stock-panel-chart"');
  const end = detail.indexOf('id="stock-panel-analysis"', start);
  assert.ok(start >= 0 && end > start);
  const panel = detail.slice(start, end);
  const mainChart = panel.indexOf("<InlineTradingChart");
  const guide = panel.indexOf("<AnalysisVisualGuide");
  assert.ok(mainChart >= 0 && mainChart < guide);
  assert.doesNotMatch(panel, /<details|<summary/);
  assert.doesNotMatch(panel, /チャートで確認|href=\{`\/chart\/\$\{signal\.code\}\`\}/);
  assert.match(panel, /takeProfit=\{hasReferencePrice \? takeProfit : null\}/);
  assert.match(panel, /stopLoss=\{hasReferencePrice \? stopLoss : null\}/);
  assert.match(panel, /isFavorite=\{isFavorite\}/);
  assert.match(panel, /onToggleFavorite=\{\(\) => void toggleFavorite\(\)\}/);
  assert.match(inline, /import TradingChart from "@\/app\/chart\/\[code\]\/components\/TradingChart"/);
  assert.match(inline, /aria-pressed=\{isFavorite\}/);
  assert.match(inline, /onClick=\{onToggleFavorite\}/);
  assert.doesNotMatch(inline, /上の青いリンク/);
  assert.match(inline, /<TradingChart/);
});

test("5m 15m 1H daily weekly monthly switch and fetch real source with stale warning", () => {
  for (const tf of ['"5m"', '"15m"', '"1H"', '"1D"', '"1W"', '"1M"']) {
    assert.ok(inline.includes(tf), tf);
  }
  assert.match(inline, /useState<Timeframe>\("5m"\)/);
  assert.match(inline, /setTimeframe\(option.value\)/);
  assert.match(inline, /\/api\/chart\//);
  assert.match(inline, /\?tf=\$\{timeframe\}/);
  assert.match(inline, /cache: "no-store"/);
  assert.match(inline, /signal: controller.signal/);
  assert.match(inline, /Array.isArray\(payload.candles\)/);
  assert.match(inline, /quoteAt/);
  assert.match(inline, /lastJstDate !== todayJst/);
  assert.match(inline, /約定価格・リアルタイムの売買サインではありません/);
  assert.match(inline, /TradingChart/);
  assert.doesNotMatch(inline, /mockCandles|fakeCandles|Math.random/);
});
