import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const detail = readFileSync(join(root, "app/analysis/[code]/page.tsx"), "utf8");
const guide = readFileSync(join(root, "app/components/analysis/AnalysisVisualGuide.tsx"), "utf8");

test("individual analysis shows a practical verdict and real daily chart before deep sections", () => {
  const verdict = detail.indexOf("📌 まず結論");
  const visual = detail.indexOf("<AnalysisVisualGuide");
  const swingDetail = detail.indexOf("<SwingEntryCard");
  const learningDetail = detail.indexOf("AI学習データ");
  assert.ok(verdict >= 0 && verdict < visual && visual < swingDetail && swingDetail < learningDetail);
  assert.match(detail, /hasReferencePrice \? yen\(price\) : "未取得"/);
  assert.match(detail, /判定保留：株価データが不足しています/);
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

test("marks distinguish observed prices from trade recommendations", () => {
  assert.match(guide, /底確定ではない/);
  assert.match(guide, /売買サインではない/);
  assert.match(guide, /前20本の高値/);
  assert.match(guide, /前20本の安値/);
  assert.match(guide, /参考価格・確定日足の新しさ/);
  assert.match(guide, /9:05以降の5分足/);
  assert.doesNotMatch(guide, /\b(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|saveDisplaySnapshot\s*\()/i);
});
