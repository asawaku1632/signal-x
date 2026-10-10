import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  chooseReferenceSample, PRICE_SAMPLE_BANDS,
  REFERENCE_SAMPLE_ALGORITHM, stableSampleHash, getSamplePriceBand,
} from "../app/lib/learning/priceReferenceSampler.ts";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const mock = [];
// Baseline-only, time-independent synthetic Japanese stock universe across all four price ranges.
for (let i = 0; i < 120; i += 1) {
  const code = String(1000 + i);
  const band = i % 4;
  mock.push({ code, name: "Test " + code, price: [300, 1800, 5500, 15000][band] + i });
}

test("stable 5 picks spanning four saved-price bands, no Yahoo price or forward return", () => {
  const a = chooseReferenceSample("2026-10-09", mock);
  const b = chooseReferenceSample("2026-10-09", [...mock].reverse());
  assert.deepEqual(a, b); // DB row input order cannot change selection
  assert.equal(a.algorithmVersion, REFERENCE_SAMPLE_ALGORITHM);
  assert.equal(a.eligibleCount, mock.length);
  assert.equal(a.choices.length, 5);
  assert.equal(new Set(a.choices.map((x) => x.code)).size, 5);
  assert.equal(new Set(a.choices.map((x) => x.priceBand)).size, 4);
  assert.ok(a.choices.every((x) => x.baselinePrice > 0));
  assert.notDeepEqual(
    a.choices.map((x)=>x.code),
    chooseReferenceSample("2026-10-08", mock).choices.map((x)=>x.code),
  );
});
test("previously observed this trade date are excluded; only unused stocks returned", () => {
  const all = chooseReferenceSample("2026-10-09", mock);
  const observed = new Set(all.choices.map((x) => x.code));
  const newPlan = chooseReferenceSample("2026-10-09", mock, observed);
  assert.equal(newPlan.excludedAlreadyObserved, 5);
  assert.equal(newPlan.eligibleCount, mock.length - 5);
  assert.equal(newPlan.choices.length, 5);
  assert.equal(newPlan.choices.filter((x) => observed.has(x.code)).length, 0);
});
test("invalid, duplicate and null baselines are ignored, empty eligible set yields no picks", () => {
  const only = chooseReferenceSample("2026-10-09", [
    { code: "9984", name: "SBG", price: 5838 },
    { code: "9984", name: "SBG duplicate", price: 5803 },
    { code: "10AB", name: "not code", price: 1000 },
    { code: "7203", name: "negative", price: -1 },
    { code: "4502", name: "missing", price: null },
  ]);
  assert.equal(only.choices.length, 1);
  assert.equal(only.choices[0].baselinePrice, 5838);
  assert.equal(chooseReferenceSample("2026-10-09", [], new Set()).choices.length, 0);
  assert.throws(() => chooseReferenceSample("2026-10-09", mock, new Set(), 6), /INVALID_SAMPLE_LIMIT/);
  assert.throws(() => chooseReferenceSample("not-a-date", mock), /INVALID_SAMPLE_DATE/);
  assert.equal(stableSampleHash("9984"), stableSampleHash("9984"));
});
test("stratification thresholds match four simple baseline price ranges", () => {
  assert.deepEqual([999,1000,2999,3000,9999,10000].map(getSamplePriceBand),
    [PRICE_SAMPLE_BANDS[0],PRICE_SAMPLE_BANDS[1],PRICE_SAMPLE_BANDS[1],PRICE_SAMPLE_BANDS[2],PRICE_SAMPLE_BANDS[2],PRICE_SAMPLE_BANDS[3]]);
});
test("candidate endpoint is admin-only, read-only, no external calls or cron", () => {
  const api = read("app/api/admin/daily-price-sample/route.ts");
  const repository = read("app/lib/learning/priceReferenceSampleRepository.ts");
  const sampler = read("app/lib/learning/priceReferenceSampler.ts");
  const page = read("app/admin/daily-price-reference/page.tsx");
  assert.match(api, /getAdminSession/);
  assert.match(api, /if \(!isAdmin\)/);
  assert.match(api, /getSuggestedPriceReferenceBatch/);
  assert.match(api, /Cache-Control.*private, no-store/);
  assert.match(repository, /MAX_SAMPLE_UNIVERSE \+ 1/);
  assert.match(repository, /INSUFFICIENT_DAILY_COVERAGE/);
  assert.match(repository, /date < \$1/);
  assert.match(repository, /WHERE date = \$1 ORDER BY code LIMIT \$2/);
  // Production daily_stock_results.date is TEXT, not SQL DATE; do not cast bound date.
  assert.doesNotMatch(repository, /daily_stock_results[^"\n]*date [=<] \$1::date/);
  assert.match(repository, /SELECT code, name, price FROM public\.daily_stock_results/);
  assert.match(repository, /SELECT DISTINCT code FROM public\.daily_learning_price_reference_audits/);
  assert.doesNotMatch(api + repository + sampler, /\bfetch\(|\bINSERT\b|\bUPDATE\b|\bDELETE\b|yahoo\.com|runScan\(|sendNotification\(/i);
  assert.match(page, /suggestCandidates/);
  assert.match(page, /\/api\/admin\/daily-price-sample/);
  assert.match(page, /Yahoo日足と照合して別保存する/);
  assert.match(page, /最大5件/);
  assert.match(repository, /getAvailablePriceReferenceDates/);
  assert.match(repository, /HAVING COUNT\(\*\) BETWEEN \$3 AND \$4/);
  assert.match(repository, /COUNT\(DISTINCT r\.code\)/);
  assert.match(repository, /r\.trade_date = d\.date::date/);
  assert.match(api, /params\.get\("mode"\) === "dates"/);
  assert.match(api, /getAvailablePriceReferenceDates\(\)/);
  assert.match(page, /availableDates\.map/);
  assert.match(page, /suggestCandidates\(day\.date\)/);
  assert.match(page, /requestedDate \? "\?date="/);
  assert.match(page, /保存済みの取引日から選ぶ/);
});
