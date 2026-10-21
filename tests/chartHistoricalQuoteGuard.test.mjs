import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const page = read("app/chart/[code]/page.tsx");
const header = read("app/chart/[code]/components/ChartHeader.tsx");
const trading = read("app/chart/[code]/components/TradingChart.tsx");
const support = read("app/chart/[code]/components/SupportResistanceCard.tsx");

test("previous-day, missing, and failed-refresh quotes all get a historical guard", () => {
  assert.match(page, /const quoteTimestampKnown =/);
  assert.match(page, /Number\.isFinite\(chart\.latestBarTimestamp\)/);
  assert.match(page, /!quoteTimestampKnown\s*\|\|\s*quoteIsFromEarlierDay\(chart\.latestBarTimestamp\)\s*\|\|\s*chart\.status === "stale"/);
  assert.match(page, /\{historicalQuote \? \(/);
  assert.match(page, /前回の株価・AI判定を表示中/);
  assert.match(page, /株価の取得時刻が不明です/);
});

test("chart header, plotted price and support level label a saved quote rather than live price", () => {
  assert.match(page, /historicalQuote=\{historicalQuote\}/);
  assert.match(header, /前回判定: /);
  assert.match(header, /前回の傾向: /);
  assert.match(header, /前回参考値/);
  assert.match(page, /priceLabel=\{referencePriceLabel\}/);
  assert.match(trading, /label: priceLabel \?\? "参考値"/);
  assert.match(support, /label=\{priceLabel \?\? "参考値"\}/);
  assert.doesNotMatch(trading, /label: "現在値"/);
  assert.doesNotMatch(support, /label="現在値"/);
});

test("historical quote caveat carries through to AI projections and simulation", () => {
  assert.match(page, /以下のAI未来予測・利確／損切目安は前回の保存価格/);
  assert.match(page, /株価は前回の参考値であり、今朝の取引価格ではありません/);
  assert.match(page, /保存データ上では/);
  assert.match(page, /参考価格は支持線と抵抗線の間/);
  assert.doesNotMatch(page, /実際の株式注文・金銭の取引は発生しません。.*?fetch\(/s);
});
