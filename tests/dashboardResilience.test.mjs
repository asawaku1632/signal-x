import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isTodayMarketReady } from "../app/dashboard/dashboardResilience.ts";

const dashboard = readFileSync("app/dashboard/page.tsx", "utf8");

test("202 with topStock null stays in the dashboard loading fallback", () => {
  assert.equal(
    isTodayMarketReady(202, { status: "loading", topStock: null }),
    false,
  );
  assert.match(dashboard, /marketData\?\.topStock && marketData\.status !== "loading"/);
  assert.match(dashboard, /市場データ準備中/);
});

test("200 with topStock keeps the existing code and name rendering", () => {
  assert.equal(
    isTodayMarketReady(200, {
      status: "fresh",
      topStock: { code: "7203", name: "Toyota" },
    }),
    true,
  );
  assert.match(dashboard, /marketData\.topStock\.code/);
  assert.match(dashboard, /marketData\.topStock\.name/);
});

test("learning API failure is isolated to its card", () => {
  assert.match(dashboard, /setLearningError\(true\)/);
  assert.match(dashboard, /learningError \? \(/);
  assert.match(dashboard, /AI学習データを取得できませんでした/);
  assert.match(dashboard, /今日のSIGNALX AI/);
  assert.match(dashboard, /今日のAI TOP5/);
  assert.match(dashboard, /<BottomNav \/>/);
});

test("both API failures retain local fallbacks without an unguarded topStock render", () => {
  assert.equal(isTodayMarketReady(500, null), false);
  assert.match(dashboard, /setMarketData\(null\)/);
  assert.match(dashboard, /setLearningData\(null\)/);
  assert.doesNotMatch(dashboard, /\{marketData && \(/);
});
