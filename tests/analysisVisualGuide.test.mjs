import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const detail = readFileSync(join(root, "app/analysis/[code]/page.tsx"), "utf8");
const guide = readFileSync(join(root, "app/components/analysis/AnalysisVisualGuide.tsx"), "utf8");
const layout = readFileSync(join(root, "app/analysis/[code]/layout.tsx"), "utf8");

test("stock summary, swing, chart link, AI learning, key metrics, stacked prices, then chart", () => {
  const items = [
    "/* Main summary:", "<SwingEntryCard", '<Link href={`/chart/${signal.code}`}',
    "AI学習データ", ">重要指標</h2>", "💰 利益とリスク",
    "仮の利確価格", "仮の損切価格", "<AnalysisVisualGuide",
    "<SwingHistoricalEvidence", "保存データを表示中"
  ];
  const offsets=items.map(x=>detail.indexOf(x));
  assert.ok(offsets.every(x=>x>=0), JSON.stringify(offsets));
  assert.ok(offsets.slice(1).every((x,i)=>x>offsets[i]), JSON.stringify(offsets));
  assert.match(detail, /hasReferencePrice \? yen\(price\) : "未取得"/);
  assert.doesNotMatch(detail, /📌 まず結論/);
});

test("owner-only research widgets stay after main stock content", () => {
  const content = layout.indexOf("  {children}\n  <div");
  const owner = layout.indexOf("<OwnerCandleNineSummary");
  const buyEvents = layout.indexOf("この銘柄の新規買い条件・成立記録");
  assert.ok(content > 0 && content < owner && owner < buyEvents);
  assert.match(layout, /if\(!isOwner\)return <>\{children\}<\/>;/);
  assert.match(layout, /getLearningOwnerSession/);
});

test("visual guide uses actual completed daily candles only, never fake data", () => {
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

test("chart observation is separate from swing decision", () => {
  assert.match(guide, /チャートから分かること/);
  assert.doesNotMatch(guide, /swingLabel|swingSummary|スイング判定\)/);
  assert.match(guide, /底確定ではない/);
  assert.match(guide, /売買サインではない/);
  assert.match(guide, /前20本の高値/);
  assert.match(guide, /前20本の安値/);
  assert.match(guide, /9:05以降の5分足/);
  assert.doesNotMatch(guide, /\b(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|saveDisplaySnapshot\s*\()/i);
});
