import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { rankDailyScanCandidates } from "../app/lib/scanDailyRanking.ts";

const stock = (code, score, price, changePercent = 0, volumeRatio = 1) =>
  ({ code, score, price, changePercent, volumeRatio });

test("affordability is applied before TOP10 and TOP3 selection", () => {
  const expensive = Array.from({ length: 12 }, (_, i) =>
    stock(String(1000 + i), 100 - i, 5000));
  const affordable = Array.from({ length: 7 }, (_, i) =>
    stock(String(2000 + i), 80 - i, 1000));
  const universe = [...expensive, ...affordable];

  const strong = rankDailyScanCandidates(universe, {
    budget: 100000, filter: "strong", sort: "score",
  });
  assert.equal(strong.length, 7);
  assert.equal(strong[0].code, "2000");
  assert.ok(strong.every((item) => item.price * 100 <= 100000));

  const hot = rankDailyScanCandidates(universe, {
    budget: 100000, filter: "hot", sort: "score",
  });
  assert.deepEqual(hot.map((item) => item.code), ["2000", "2001", "2002"]);
});

test("ranking is stable and independent of source order", () => {
  const rows = [
    stock("2222", 90, 1000, 1, 2),
    stock("1111", 90, 1000, 1, 2),
    stock("3333", 90, 1000, 2, 1),
  ];
  const options = { budget: "all", filter: "all", sort: "score" };
  const ranked = rankDailyScanCandidates(rows, options);
  assert.deepEqual(ranked.map((item) => item.code), ["3333", "1111", "2222"]);
  assert.deepEqual(rows.map((item) => item.code), ["2222", "1111", "3333"]);
});

test("invalid price and score never become recommended candidates", () => {
  const rows = [
    stock("1000", 98, 0),
    stock("1001", 95, Number.NaN),
    stock("1002", Number.NaN, 1000),
    stock("1003", 90, 999),
  ];
  const result = rankDailyScanCandidates(rows, {
    budget: 100000, filter: "all", sort: "score",
  });
  assert.deepEqual(result.map((item) => item.code), ["1003"]);
});

test("price sort changes displayed ranks without changing budget eligibility", () => {
  const rows = [
    stock("2000", 90, 2800),
    stock("2001", 88, 800),
    stock("2002", 86, 1500),
    stock("2003", 84, 4000),
  ];
  const result = rankDailyScanCandidates(rows, {
    budget: 300000, filter: "all", sort: "cheap",
  });
  assert.deepEqual(result.map((item) => item.code), ["2001", "2002", "2000"]);
});

test("mobile rank-1 card matches the first ranked stock and does not invent AI win rate", () => {
  const source = readFileSync(new URL("../app/scan-mobile/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const bestSignal = filteredStocks\[0\] \?\? null;/);
  assert.match(source, /const podiumStocks = filteredStocks\.slice\(0, 5\)/);
  assert.match(source, /rankDailyScanCandidates\(stocks,/);
  assert.match(source, /DAILY WATCHLIST · TOP 5/);
  assert.match(source, /株価基準日/);
  assert.doesNotMatch(source, /aiWinRateText|AI勝率 \{/);
  assert.doesNotMatch(source, /38万円|380000/);
  assert.match(source, /\[100000, 300000, 500000, 1000000, "all"\]/);
});
