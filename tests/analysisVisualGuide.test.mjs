import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const detail = readFileSync(join(root, "app/analysis/[code]/page.tsx"), "utf8");
const guide = readFileSync(join(root, "app/components/analysis/AnalysisVisualGuide.tsx"), "utf8");
const layout = readFileSync(join(root, "app/analysis/[code]/layout.tsx"), "utf8");

test("four top tabs are independent and render previous content without duplication", () => {
  for (const [key, label] of [
    ["overview", "概要"], ["chart", "チャート"],
    ["analysis", "分析"], ["catalog", "図鑑連携"]
  ]) {
    assert.match(detail, new RegExp('key: "' + key + '", label: "' + label + '"'));
    assert.ok(detail.includes('id="stock-panel-' + key + '"'));
    assert.ok(detail.includes('aria-labelledby="stock-tab-' + key + '"'));
    assert.ok(detail.includes('hidden={activeTab !== "' + key + '"}'));
    assert.ok(detail.includes('activeTab === "' + key + '" &&'));
  }
  assert.match(detail, /role="tablist" aria-label="銘柄ページの表示切り替え"/);
  assert.match(detail, /role="tab"/);
  assert.match(detail, /aria-selected={activeTab === tab.key}/);
  assert.match(detail, /setActiveTab\(tab.key\)/);
  assert.match(detail, /ArrowLeft/);
  assert.match(detail, /ArrowRight/);
  assert.match(detail, /useEffect\(\(\) => \{ setActiveTab\("overview"\); \}, \[code\]\)/);
  assert.doesNotMatch(detail, /📌 まず結論/);
  assert.match(detail, /hasReferencePrice \? yen\(price\) : "未取得"/);

  const order = [
    'id="stock-panel-overview"', "/* Main summary:", "<SwingEntryCard",
    "💰 利益とリスク", "<AnalysisVisualGuide code={signal.code}",
    'id="stock-panel-chart"', "📈 チャートで確認",
    "<InlineTradingChart", "🔎 参考日足の目印と読み方を見る",
    'id="stock-panel-analysis"', "AI学習データ", ">重要指標</h2>",
    "<SwingHistoricalEvidence", 'id="stock-panel-catalog"',
    "<PatternList detectedPatterns=", "<DoubleBottomVisualLesson"
  ];
  const offsets = order.map(text => detail.indexOf(text));
  assert.ok(offsets.every(value => value >= 0), JSON.stringify(offsets));
  assert.ok(offsets.slice(1).every((v,i) => v > offsets[i]), JSON.stringify(offsets));
  const chartTab = detail.indexOf('id="stock-panel-chart"');
  const fullDailyGuide = detail.indexOf("        <AnalysisVisualGuide", chartTab);
  assert.ok(fullDailyGuide > detail.indexOf("🔎 参考日足の目印と読み方を見る"));

  assert.equal((detail.match(/<PatternList detectedPatterns=/g) ?? []).length, 1);
  assert.equal((detail.match(/<BottomNav/g) ?? []).length, 1);
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
