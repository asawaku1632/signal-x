import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("owner-only stock layout shows collapsed summary above regular detail; nonowner gets ONLY children", () => {
  const layout = read("app/analysis/[code]/layout.tsx");
  const ownerGate = layout.indexOf("if(!isOwner)return <>{children}</>");
  const card = layout.indexOf("<OwnerCandleNineSummary key={code}");
  const regularDetail = layout.indexOf("{children}", card);
  assert.ok(ownerGate >= 0 && card > ownerGate && regularDetail > card);
  assert.ok(layout.indexOf('href={"/admin/new-buy-events?',card) > card);
  assert.match(layout,/getLearningOwnerSession/);
  assert.match(layout,/\^\[0-9A-Za-z\]\{4,5\}\$/);
});

test("accordion loads ONLY on opening, never as background page request, and offers owner detail link", () => {
  const component = read("app/components/analysis/OwnerCandleNineSummary.tsx");
  assert.match(component,/^"use client"/);
  assert.match(component,/<details/);
  assert.match(component,/onToggle=\{event =>/);
  assert.match(component,/event\.currentTarget\.open && state === "idle"/);
  assert.match(component,/onClick=\{\(\) => void load\(\)\}/);
  assert.match(component,/inFlight\.current \|\| report/);
  assert.match(component,/method: "POST"/);
  assert.match(component,/cache: "no-store"/);
  assert.match(component,/<ShadowNineOverview/);
  assert.match(component,/\/"\}/); // React syntax for known owner UI
  assert.match(component,/prefetch=\{false\}/);
  assert.doesNotMatch(component,/\buseEffect\s*\(/);
  assert.doesNotMatch(component,/\b(?:sendLine|saveDisplaySnapshot|runScan|placeOrder)\s*\(/);
});

test("research endpoint checks owner and origin before 1 Yahoo fetch and never stores or modifies production", () => {
  const source=read("app/api/admin/shadow-candle-nine-overview/route.ts");
  const auth=source.indexOf("await getLearningOwnerSession()");
  const ownerReject=source.indexOf("if (!isOwner)");
  const origin=source.indexOf('request.headers.get("origin")');
  const jsonParse=source.indexOf("await request.json()");
  const input=source.indexOf('if (!/^[0-9A-Z]{4,5}$/.test(code))');
  const yahoo=source.indexOf("await fetchCohort([code])");
  const db=source.indexOf("await pool.query<ArchivedShadowRun>");
  assert.ok(auth >= 0 && ownerReject > auth && origin > ownerReject && jsonParse > origin && input > jsonParse);
  assert.ok(yahoo > input && db > yahoo);
  assert.match(source,/getLearningOwnerSession/);
  assert.match(source,/SHADOW_CANDLE_DETECTOR_VERSION/);
  assert.match(source,/evaluateShadowBuyCaution/);
  assert.match(source,/summarizeShadowNine/);
  assert.match(source,/Cache-Control": "private, no-store/);
  assert.doesNotMatch(source,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|sendLine|runScan|placeOrder)\s*\(/i);
  assert.doesNotMatch(source,/fetchCohort\(\w+Codes\)/);
});

test("reuses research-only overview, not a new trading accuracy score", () => {
  const src = read("app/api/admin/shadow-candle-nine-overview/route.ts");
  assert.match(src,/studyShadowCandlePatterns\(candles\)/);
  assert.match(src,/combineArchivedShadowRuns\(archive\.rows\)/);
  assert.match(src,/summarizeShadowNine\(studies, candles, caution\)/);
  assert.match(src,/archiveAvailable: archiveRows !== null/);
  const component=read("app/components/analysis/OwnerCandleNineSummary.tsx");
  assert.match(component,/研究結果は買い推奨や購入禁止を意味しません/);
  assert.match(component,/本人専用・タップして開く/);
});
