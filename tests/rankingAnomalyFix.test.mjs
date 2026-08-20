import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DAILY_FALLBACK_MAX_AGE_MS,
  isYahooDailyBarFresh,
} from "../app/lib/yahooBarFreshness.ts";
import {
  formatAiRankingPosition,
  normalizeRankingUniverseCount,
} from "../app/lib/rankingUniverse.ts";
import { STOCKS } from "../app/lib/stockList.ts";

function activeOnDate(stock, date) {
  const asOf = new Date(new Date(date).getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  if (stock.listedFrom && asOf < stock.listedFrom) return false;
  if (stock.listedUntil && asOf > stock.listedUntil) return false;
  if ((stock.status ?? "ACTIVE") === "ACTIVE") return true;
  return Boolean(stock.listedUntil && asOf <= stock.listedUntil);
}

test("4449 is historical and 590A is an active alphanumeric successor", () => {
  const oldStock = STOCKS.find(({ code }) => code === "4449");
  const successor = STOCKS.find(({ code }) => code === "590A");

  assert.deepEqual(oldStock, {
    code: "4449",
    name: "ギフティ",
    status: "TRANSFERRED",
    listedUntil: "2026-06-29",
    successorCode: "590A",
  });
  assert.deepEqual(successor, {
    code: "590A",
    name: "ギフティグループ",
    status: "ACTIVE",
    listedFrom: "2026-07-01",
  });
  assert.equal(activeOnDate(oldStock, "2026-08-20T12:00:00Z"), false);
  assert.equal(activeOnDate(successor, "2026-08-20T12:00:00Z"), true);
  assert.equal(`${successor.code}.T`, "590A.T");

  const activeList = readFileSync("app/lib/activeStockList.ts", "utf8");
  assert.match(activeList, /isStockActiveOnDate\(stock\)/);
  assert.match(activeList, /!excludedCodeSet\.has/);
});

test("daily fallback allows weekends and holidays but rejects old bars", () => {
  const now = Date.parse("2026-08-17T09:00:00.000Z");
  const seconds = (date) => Date.parse(date) / 1000;

  assert.equal(isYahooDailyBarFresh(seconds("2026-08-17T06:00:00Z"), now), true);
  assert.equal(isYahooDailyBarFresh(seconds("2026-08-14T06:00:00Z"), now), true);
  assert.equal(isYahooDailyBarFresh(seconds("2026-08-11T06:00:00Z"), now), true);
  assert.equal(isYahooDailyBarFresh(seconds("2026-08-09T06:00:00Z"), now), false);
  assert.equal(DAILY_FALLBACK_MAX_AGE_MS, 7 * 24 * 60 * 60 * 1000);

  const analyzer = readFileSync("app/lib/learning/stockAnalyzer.ts", "utf8");
  assert.match(analyzer, /dataSource === "daily_fallback"/);
  assert.match(analyzer, /throw new StaleYahooBarError/);
});

test("ranking universe is propagated without a fabricated fallback", () => {
  assert.equal(normalizeRankingUniverseCount(958), 958);
  assert.equal(formatAiRankingPosition(1, 958), "1位 / 958銘柄中");
  assert.equal(formatAiRankingPosition(1, undefined), "1位（母数不明）");

  const ranking = readFileSync("app/api/ranking/route.ts", "utf8");
  const line = readFileSync("app/api/cron/line/route.ts", "utf8");
  const lineRanking = readFileSync("app/api/cron/line-ranking/route.ts", "utf8");
  const lineTest = readFileSync("app/api/test/line/route.ts", "utf8");

  assert.match(ranking, /scanDiagnostics\?\.analyzedSuccessCount/);
  assert.match(ranking, /rankingUniverseCount/);
  assert.doesNotMatch(`${line}\n${lineRanking}\n${lineTest}`, /\b1006\b/);
  assert.match(line, /formatAiRankingPosition/);
});
