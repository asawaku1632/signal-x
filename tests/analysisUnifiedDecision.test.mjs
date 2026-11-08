import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const detail = readFileSync(join(root, "app/analysis/[code]/page.tsx"), "utf8");
const morning = readFileSync(join(root, "app/components/analysis/MorningEntryRecheckCard.tsx"), "utf8");

test("the top decision distinguishes AI score tier from swing entry timing", () => {
  assert.match(detail, /AI評価帯：/);
  assert.match(detail, /新規のタイミング：/);
  assert.match(detail, /スイングの「.*」は新規購入のタイミング評価/);
  assert.match(detail, /AI POWERの「.*」は注目度の評価/);
  assert.ok(detail.indexOf("📌 まず結論") < detail.indexOf("<AnalysisVisualGuide"));
  assert.match(detail, /case "WAIT":\s*return \{ title: "監視候補・押し目待ち"/);
  assert.match(detail, /case "CANDIDATE":\s*return \{ title: "監視候補（購入条件は再確認）"/);
  assert.match(detail, /case "AVOID":\s*return \{ title: "見送り（新規購入は慎重に）"/);
});

test("hypothetical P/L is folded for wait/watch/avoid and never called expected profit", () => {
  assert.match(detail, /<details open=\{swingEntryDecision\.status === "CANDIDATE"\}/);
  assert.match(detail, /もし参考株価で100株買った場合の試算/);
  assert.match(detail, /仮の利益/);
  assert.match(detail, /仮の利確価格/);
  assert.match(detail, /仮の損切価格/);
  assert.match(detail, /今は新規購入を待つ・見送る判定なので、初めから折りたたんでいます/);
  assert.doesNotMatch(detail, /期待利益 \+\{yen\(profitYen\)\}/);
});

test("past outcome ratio is not portrayed as predicted probability and count mismatch is visible", () => {
  assert.match(detail, /過去の判定済み勝率/);
  assert.match(detail, /今回の銘柄を今から買ったときの勝率ではなく/);
  assert.match(detail, /const unclassifiedCount = total - \(win \+ lose \+ hold\)/);
  assert.match(detail, /集計確認：検証\{total\}件とWIN・LOSE・HOLDの合計/);
  assert.match(detail, /独自参考指数/);
  assert.match(detail, /\$\{aiTrust\}点/);
});

test("neither top-level conclusion nor morning recheck implies a brokerage order was placed", () => {
  assert.match(detail, /このページで実際の株式注文は行いません/);
  assert.match(detail, /保存時点の分析です/);
  assert.match(morning, /アプリから発注しません/);
  assert.doesNotMatch(morning, />発注なし<\/span>/);
});
