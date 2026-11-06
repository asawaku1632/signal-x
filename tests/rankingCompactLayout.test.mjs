import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../app/ranking/page.tsx", import.meta.url), "utf8");

test("ranking shows compact cards immediately with no duplicated giant first-place card", () => {
  assert.match(src, /🏆 AIランキング/);
  assert.match(src, /data-testid="compact-ranking-card"/);
  assert.match(src, /visibleStocks\.map\(\(stock, index\)/);
  assert.doesNotMatch(src, /👑 本日の最有力|text-5xl font-black|👑 TODAY BEST|🔥 HOT/);
  assert.doesNotMatch(src, /<Stats stock=\{top\}/);
  assert.match(src, /className="mt-3 space-y-2"/);
});

test("fast budget selections and search remain usable and include 100万円", () => {
  assert.match(src, /grid grid-cols-5 gap-1\.5/);
  assert.match(src, /QUICK_BUDGET_OPTIONS\.map/);
  assert.match(src, /value: "1000000", label: "100万"/);
  assert.match(src, /value: "1000000", label: "100万円"/);
  assert.match(src, /aria-label="銘柄コード・名前で検索"/);
  assert.match(src, /setKeyword\(event\.target\.value\)/);
  assert.match(src, /setSortMode\(event\.target\.value as SortMode\)/);
  assert.match(src, /setBudgetMode\(event\.target\.value as BudgetMode\)/);
});

test("compact card displays essentials and supports drill-down for full saved metrics", () => {
  for (const field of ["参考株価", "100株必要額", "変化率", "AI評価", "過去実績・AIパターンを表示", "AI解析", "AI実績"]) {
    assert.ok(src.includes(field), "missing field: " + field);
  }
  assert.match(src, /<AiScoreTierBadge score=\{stock\.score\}/);
  assert.match(src, /<Pattern patterns=\{stock\.detectedPatterns\}/);
  assert.match(src, /const priceKnown = Number\.isFinite\(stock\.price\) && stock\.price > 0/);
  assert.match(src, /\{priceKnown \? yen\(stock\.price \* 100\) : "—"\}/);
  assert.match(src, /href \+ "\/performance"/);
  assert.match(src, /<details className="mt-2 border-t/);
});

test("next 20 works without hiding the remaining TOP100 and order is preserved", () => {
  assert.match(src, /const \[visibleCount, setVisibleCount\] = useState\(20\)/);
  assert.match(src, /filteredStocks\.slice\(0, visibleCount\)/);
  assert.match(src, /Math\.min\(value \+ 20, 100\)/);
  assert.match(src, /\.slice\(0, 100\)/);
  assert.match(src, /sortMode === "winRate"/);
  assert.match(src, /sortMode === "expectedProfit"/);
  assert.match(src, /sortMode === "capital"/);
});

test("ranking is presented as saved data, no unsupported live or win rate claims", () => {
  assert.match(src, /latestQuoteDateJst/);
  assert.match(src, /updatedAt/);
  assert.match(src, /保存AI評価のランキング/);
  assert.match(src, /東証全銘柄の完全ランキングではありません/);
  assert.match(src, /勝敗確定/);
  assert.match(src, /HOLD/);
  assert.match(src, /証券会社のリアルタイム株価とは異なる/);
  assert.match(src, /実測勝率や買い時を示すものではありません/);
});
