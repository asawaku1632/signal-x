import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const detail = readFileSync(join(root, "app/analysis/[code]/page.tsx"), "utf8");
const guide = readFileSync(join(root, "app/components/analysis/AnalysisVisualGuide.tsx"), "utf8");
const layout = readFileSync(join(root, "app/analysis/[code]/layout.tsx"), "utf8");

test("stock summary followed by annotated chart, then swing and historical details", () => {
  const stockSummary = detail.indexOf("/* Main summary:");
  const chart = detail.indexOf("<AnalysisVisualGuide");
  const swing = detail.indexOf("<SwingEntryCard");
  const historical = detail.indexOf("<SwingHistoricalEvidence");
  const learning = detail.indexOf("AI学習データ");
  const profit = detail.indexOf("もし参考株価で100株買った場合の試算");
  const metrics = detail.indexOf('>重要指標</h2>');
  assert.ok(stockSummary >= 0 && stockSummary < chart && chart < swing);
  assert.ok(swing < historical && historical < learning && learning < profit && profit < metrics);
  assert.match(detail, /hasReferencePrice \? yen\(price\) : "未取得"/);
  assert.doesNotMatch(detail, /📌 まず結論/);
});

test("owner-only research widgets come after main stock content, not before", () => {
  const content = layout.indexOf("  {children}\n  <div");
  const owner = layout.indexOf("<OwnerCandleNineSummary");
  const buyEvents = layout.indexOf("この銘柄の新規買い条件・成立記録");
  assert.ok(content > 0 && content < owner && owner < buyEvents);
  assert.match(layout, /if\(!isOwner\)return <>\{children\}<\/>;/);
  assert.match(layout, /getLearningOwnerSession/);
});

test("visual guide uses actual completed daily candles only and does not invent signals", () => {
  assert.match(guide, /\/api\/chart\//);
  assert.match(guide, /\?tf=1D/);
  assert.match(guide, /payload\.candles/);
  assert.match(guide, /filter\(validCandle\)/);
  assert.match(guide, /filter\(\(candle\) => isCompletedDay\(candle\.time, now\)\)/);
  assert.match(guide, /hour >= 16/);
  assert.match(guide, /candles\.length < 22/);
  assert.match(guide, /参考日足が不足・取得失敗のため、目印は表示しません/);
  assert.doesNotMatch(guide, /Math\.random|mockCandles|fakeCandles/);
});

test("chart shows observations without duplicate swing verdict", () => {
  assert.match(guide, /チャートから分かること/);
  assert.doesNotMatch(guide, /swingLabel|swingSummary|スイング判定\)/);
  assert.match(guide, /底確定ではない/);
  assert.match(guide, /売買サインではない/);
  assert.match(guide, /前20本の高値/);
  assert.match(guide, /前20本の安値/);
  assert.match(guide, /9:05以降の5分足/);
  assert.doesNotMatch(guide, /\b(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|saveDisplaySnapshot\s*\()/i);
});
