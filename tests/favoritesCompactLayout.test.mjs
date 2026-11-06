import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/favorites/page.tsx", import.meta.url), "utf8");

test("favorites starts with compact count and cards, not oversized banner and action buttons", () => {
  assert.match(source, /⭐ お気に入り/);
  assert.match(source, /\{favorites\.length\}銘柄/);
  assert.match(source, /data-testid="favorite-compact-stock-card"/);
  assert.match(source, /className="space-y-2"/);
  assert.match(source, /text-base font-black leading-6/);
  assert.doesNotMatch(source, /bg-gradient-to-br from-white to-yellow-50|text-4xl font-black/);
  assert.doesNotMatch(source, /🔍 個別解析を見る/);
});

test("every compact card displays comparable verified quote fields and a detail link", () => {
  for (const label of ["AI評価", "参考株価", "100株必要額", "変化率", "詳しく ›"]) {
    assert.ok(source.includes(label), "missing visible field: " + label);
  }
  assert.match(source, /grid grid-cols-3 gap-1 rounded-xl/);
  assert.match(source, /yen\(stock\.price \* 100\)/);
  assert.match(source, /href = "\/analysis\/" \+ encodeURIComponent\(stock\.code\)/);
  assert.match(source, /quoteAsOf\(stock\.latestBarTimestamp\)/);
  assert.match(source, /過去日データ/);
});

test("removal retains server DELETE and requires confirmation to prevent accidental taps", () => {
  assert.match(source, /method: "DELETE"/);
  assert.match(source, /window\.confirm\(stock\.name \+ " をお気に入りから削除しますか？"\)/);
  assert.match(source, /void removeFavorite\(stock\.code\)/);
  assert.match(source, /disabled=\{removingCode !== null\}/);
  assert.match(source, /aria-label=\{stock\.name \+ "をお気に入りから削除"\}/);
});

test("unavailable quotes are not shown as real zero prices, scores, or changes", () => {
  assert.match(source, /const hasQuote = Number\.isFinite\(stock\.price\) && stock\.price > 0/);
  assert.match(source, /const power = hasQuote && Number\.isFinite\(rawPower\) \? rawPower : null/);
  assert.match(source, /power === null \? "未取得"/);
  assert.match(source, /\{hasQuote \? yen\(stock\.price\) : "—"\}/);
  assert.match(source, /\{hasQuote \? yen\(stock\.price \* 100\) : "—"\}/);
  assert.match(source, /\{change === null \? "—"/);
  assert.doesNotMatch(source, /reason: "最新データを取得できませんでした",[\s\S]*?aiPower: 0/);
});

test("warning text and snapshot time are preserved below the cards in a disclosure", () => {
  const cards = source.indexOf('{favorites.map((stock) => {');
  const details = source.indexOf('<details className="mt-4');
  assert.ok(cards >= 0 && details > cards);
  assert.match(source, /scanUpdatedAt/);
  assert.match(source, /保存済みスキャンの参考価格/);
  assert.match(source, /リアルタイム株価とは異なる場合/);
  assert.match(source, /\/api\/favorites/);
  assert.match(source, /\/api\/scan\?limit=1000/);
});
