import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const replay = readFileSync(join(root, "app/admin/shape-precision-audit/replay/page.tsx"), "utf8");

test("mobile shows enlarged recent chart first, then concise verdict and detailed classification", () => {
  const chart = replay.indexOf("保存時点までの参考日足と目印");
  const summary = replay.indexOf("まず結論：何が分かった？");
  const guide = replay.indexOf("図鑑のように見分ける・この形の分類");
  assert.ok(chart >= 0 && chart < summary && summary < guide);
  assert.match(replay, /<CandleChart candles=\{candles\} replay=\{replay\} marks=\{conditionMarks\} recentOnly/);
  assert.match(replay, /直近22本を拡大/);
  assert.match(replay, /全期間のチャート・紫①②の日付を見る/);
  assert.match(replay, /今、買う？ 売る？ → この画面だけでは未判定/);
});

test("visual annotations label only actual observed pivots and condition matches", () => {
  for (const phrase of [
    "底①", "底②", "①一致開始", "②最終一致",
    "参考の壁", "オレンジ破線：", "青の底①②：", "紫の①②：",
  ]) assert.ok(replay.includes(phrase), phrase);
  assert.match(replay, /replay\?\.low1\.index === absoluteIndex/);
  assert.match(replay, /replay\?\.low2\.index === absoluteIndex/);
  assert.match(replay, /marks\.find\(item => item\.index === absoluteIndex\)/);
  assert.match(replay, /firstIndex = recentOnly \? Math\.max\(0, candles\.length - 22\) : 0/);
});

test("research result is not misrepresented as a daily breakout or buy recommendation", () => {
  assert.match(replay, /doubleBottomStageLabel\(originalStage\)/);
  assert.match(replay, /安値2つの基本条件に一致（上抜けの確認とは別）/);
  assert.match(replay, /厳密な上抜けの確認ではない/);
  assert.match(replay, /今、買う？ 売る？ → この画面だけでは未判定/);
  assert.match(replay, /元の5分足判定の買い・売り時刻を再現したものではありません/);
  assert.match(replay, /shapeConditionMarks\(candles/);
  assert.match(replay, /isDoubleBottom\?Boolean\(inspectEarlierDailyCandles\(prefix\)\)/);
  assert.doesNotMatch(replay, /\b(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|saveDisplaySnapshot\s*\()/i);
});
