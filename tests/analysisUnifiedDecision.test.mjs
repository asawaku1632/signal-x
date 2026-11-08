import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const detail = readFileSync(join(root, "app/analysis/[code]/page.tsx"), "utf8");
const morning = readFileSync(join(root, "app/components/analysis/MorningEntryRecheckCard.tsx"), "utf8");

test("top card preserves separate AI rating and new-entry timing labels", () => {
  assert.match(detail, /AI評価帯：/);
  assert.match(detail, /新規のタイミング：/);
  assert.ok(detail.indexOf("新規のタイミング：") < detail.indexOf("<AnalysisVisualGuide"));
  assert.match(detail, /<AiScoreTierBadge score=/);
});

test("swing judgment remains visible below chart, with reasons in an accordion", () => {
  assert.match(detail, /<h2 className="text-base font-black">📅 スイング判定<\/h2>/);
  assert.match(detail, /<p className="mt-3 text-sm font-black leading-6">\{decision\.summary\}<\/p>/);
  assert.match(detail, /▶ 判定理由・詳しい説明を見る/);
  assert.match(detail, /AI評価帯の「買い候補」とは別です/);
  assert.ok(detail.indexOf("<AnalysisVisualGuide") < detail.indexOf("<SwingEntryCard"));
  assert.doesNotMatch(detail, /📌 まず結論|上の結論と同じ新規購入の評価です|新規購入の判断（保存時点）/);
});

test("hypothetical P/L is folded for wait/watch/avoid", () => {
  assert.match(detail, /<details open=\{swingEntryDecision\.status === "CANDIDATE"\}/);
  assert.match(detail, /もし参考株価で100株買った場合の試算/);
  assert.match(detail, /仮の利益/);
  assert.match(detail, /仮の利確価格/);
  assert.match(detail, /仮の損切価格/);
  assert.doesNotMatch(detail, /期待利益 \+\{yen\(profitYen\)\}/);
});

test("past results remain distinct from current purchase success probability", () => {
  assert.match(detail, /過去の判定済み勝率/);
  assert.match(detail, /今回の銘柄を今から買ったときの勝率ではなく/);
  assert.match(detail, /const unclassifiedCount = total - \(win \+ lose \+ hold\)/);
  assert.match(detail, /集計確認：検証\{total\}件とWIN・LOSE・HOLDの合計/);
  assert.match(detail, /独自参考指数/);
});

test("morning recheck does not imply a broker order", () => {
  assert.match(morning, /アプリから発注しません/);
  assert.doesNotMatch(morning, />発注なし<\/span>/);
});
