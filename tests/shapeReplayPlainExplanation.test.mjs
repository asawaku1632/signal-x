import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const replay = readFileSync(join(root, "app/admin/shape-precision-audit/replay/page.tsx"), "utf8");

test("plain-language verdict appears before chart, technical explanation follows", () => {
  const summary = replay.indexOf("まず結論：何が分かった？");
  const chart = replay.indexOf("保存時点までの参考日足と目印");
  const guide = replay.indexOf("図鑑のように見分ける・この形の分類");
  assert.ok(summary >= 0 && summary < chart && chart < guide);
  assert.match(replay, /今、買う？ 売る？ → この画面だけでは未判定/);
});

test("do not misrepresent saved intraday verdict as daily breakout or buy signal", () => {
  assert.match(replay, /doubleBottomStageLabel\(originalStage\)/);
  assert.match(replay, /安値2つの基本条件に一致（上抜けの確認とは別）/);
  assert.match(replay, /足の種類や判定条件が異なるため、同じ結果とは限りません/);
  assert.match(replay, /売買のタイミングを示す印ではありません/);
});

test("chart symbols are explained in plain Japanese without altering detection", () => {
  for (const phrase of [
    "紫の①②：", "青丸：", "オレンジ点線：", "緑・赤の棒：",
    "直近の一致が続き始めた日", "最後に一致した日",
  ]) assert.ok(replay.includes(phrase), phrase);
  assert.match(replay, /shapeConditionMarks\(candles/);
  assert.match(replay, /isDoubleBottom\?Boolean\(inspectEarlierDailyCandles\(prefix\)\)/);
  assert.doesNotMatch(replay, /\b(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|saveDisplaySnapshot\s*\()/i);
});
