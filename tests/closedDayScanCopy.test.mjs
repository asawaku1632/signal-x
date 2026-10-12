import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { scanDisplayLabels } from "../app/lib/scanDisplayLabels.ts";

const load = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("2026-10-12 closed-day view never labels saved values as today's live prices", () => {
  const labels = scanDisplayLabels(true);
  assert.equal(labels.headline, "保存スキャンの買い候補");
  assert.equal(labels.strongest, "保存スキャンの最有力候補");
  assert.equal(labels.quote, "保存時株価");
  assert.equal(labels.topTen, "保存スキャンのTOP10");
  assert.ok(Object.values(labels).every((label) => !label.includes("今日") && !label.includes("本日") && !label.includes("現在値")));
});

test("2026-10-13 normal trading day retains the original labels", () => {
  const labels = scanDisplayLabels(false);
  assert.equal(labels.headline, "今日の買い候補");
  assert.equal(labels.strongest, "本日の最有力候補");
  assert.equal(labels.quote, "現在値");
  assert.equal(labels.topTen, "今日のTOP10");
  assert.equal(labels.hotFilter, "今日の最有力");
});

test("mobile scan screen passes the server's holiday flag into headline, featured card and summary", () => {
  const source = load("app/scan-mobile/page.tsx");
  assert.match(source, /setMarketClosed\(json\?\.marketClosed === true\)/);
  assert.match(source, /const displayLabels = scanDisplayLabels\(marketClosed\)/);
  assert.match(source, /\{displayLabels\.description\}/);
  assert.match(source, /<FeaturedStock[^\n]*marketClosed=\{marketClosed\}/);
  assert.match(source, /\{displayLabels\.strongest\}/);
  assert.match(source, /\{displayLabels\.quote\}/);
  assert.match(source, /\{marketClosed \? "分析保存" : "最終更新"\}/);
  assert.match(source, /<option value="hot">\{displayLabels\.hotFilter\}<\/option>/);
});

test("desktop scan screen passes the same flag through all headings and cards", () => {
  const source = load("app/scan/page.tsx");
  assert.match(source, /setMarketClosed\(data\.marketClosed === true\)/);
  for (const key of ["headline", "topTen", "strongest", "quote"]) {
    assert.match(source, new RegExp(`displayLabels\\.${key}`));
  }
  assert.match(source, /<TopPickCard stock=\{topStock\} marketClosed=\{marketClosed\}/);
  assert.match(source, /<EmptyTopPickCard[^\n]*marketClosed=\{marketClosed\}/);
});

test("change remains presentation-only, with no new market-data requests or writes", () => {
  for (const path of ["app/lib/scanDisplayLabels.ts","app/scan-mobile/page.tsx","app/scan/page.tsx"]) {
    const source = load(path);
    assert.doesNotMatch(source, /\b(?:runScan|refreshScanSnapshot|saveDisplaySnapshot|updatePatternForwardOutcomes)\s*\(/);
  }
  const labels = load("app/lib/scanDisplayLabels.ts");
  assert.doesNotMatch(labels, /\b(?:fetch|pool\.query|setTimeout|setInterval)\s*\(/);
});
