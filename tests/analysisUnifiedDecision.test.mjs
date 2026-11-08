import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const detail = readFileSync(join(root, "app/analysis/[code]/page.tsx"), "utf8");
const morning = readFileSync(join(root, "app/components/analysis/MorningEntryRecheckCard.tsx"), "utf8");

test("AI category and swing timing appear beside AI POWER, before stats", () => {
  const power = detail.indexOf(">AI POWER</p>");
  const category = detail.indexOf("AI評価帯：");
  const timing = detail.indexOf("新規のタイミング：");
  const ranking = detail.indexOf(">AI順位</p>");
  assert.ok(power>=0 && power<category && category<timing && timing<ranking);
  assert.match(detail, /ml-auto flex min-w-0 flex-col items-end/);
  assert.match(detail, /<AiScoreTierBadge score=/);
  assert.doesNotMatch(detail, /参考データに基づく候補評価です。「独自参考指数」はAI評価と過去集計を合わせた参考点で、実測勝率ではありません。AI POWERが高くても購入を推奨・保証するものではありません。\s*<\/p>\s*<\/section>/);
});

test("swing label stays visible, its blue-box explanation is inside the accordion", () => {
  assert.match(detail, /<h2 className="text-base font-black">📅 スイング判定<\/h2>/);
  assert.match(detail, /▶ 判定理由・詳しい説明を見る/);
  const swing = detail.slice(detail.indexOf("function SwingEntryCard"), detail.indexOf("function getRankLabel"));
  assert.ok(swing.indexOf("<summary") > 0 && swing.indexOf("<summary") < swing.indexOf("{decision.summary}"));
  assert.ok(swing.indexOf("数日〜2週間の新規購入") > swing.indexOf("<summary"));
  assert.match(swing, /<p className="mt-3 text-sm font-black leading-6">\{decision\.summary\}<\/p>/);
  assert.ok(detail.indexOf("<SwingEntryCard")<detail.indexOf("AI学習データ"));
  assert.doesNotMatch(detail, /📌 まず結論/);
});

test("profit and stop loss are always visible and explanation is the only disclosure", () => {
  const first=detail.indexOf("💰 利益とリスク");
  const warning=detail.indexOf("▶ 試算の前提・注意点を見る",first);
  const gain=detail.indexOf("仮の利確価格",first);
  const loss=detail.indexOf("仮の損切価格",first);
  const close=detail.indexOf("        </section>\n        ) : (", first);
  assert.ok(first>0 && first<warning && warning<gain && gain<loss && loss<close);
  assert.match(detail, /<details className="mt-2 rounded-lg border border-slate-200 bg-slate-50/);
  assert.match(detail, /<div className="mt-2 grid grid-cols-1 gap-2">/);
  assert.ok(detail.indexOf("仮の利確価格") < detail.indexOf("仮の損切価格"));
  assert.match(detail, /もし.*実際の買値|実際の買値や利確・損切り注文の指示ではありません/);
  assert.doesNotMatch(detail, /<details open=\{swingEntryDecision\.status === "CANDIDATE"\}/);
  assert.match(detail, /仮の利益/);
  assert.match(detail, /仮の損切価格/);
});

test("past outcome ratio remains visible while 80 vs 79 warning is collapsible", () => {
  assert.match(detail, /過去の判定済み勝率/);
  assert.match(detail, /今回の銘柄を今から買ったときの勝率ではなく/);
  assert.match(detail, /const unclassifiedCount = total - \(win \+ lose \+ hold\)/);
  assert.match(detail, /<summary className="cursor-pointer">⚠ 集計内訳に\{Math\.abs\(unclassifiedCount\)\}件の差があります（詳しく見る）<\/summary>/);
  assert.match(detail, /集計確認：検証\{total\}件とWIN・LOSE・HOLDの合計/);
  assert.match(detail, /独自参考指数/);
});

test("morning recheck does not imply a broker order", () => {
  assert.match(morning, /アプリから発注しません/);
  assert.doesNotMatch(morning, />発注なし<\/span>/);
});
