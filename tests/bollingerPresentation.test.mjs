import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildBollingerComment,
  getBandWalkRiskLabel,
  getBollingerExpectationLabel,
  getBollingerStatusLabel,
  getExpectationLevel,
  getBollingerTitle,
  isVisibleBollingerSignal,
} from "../app/lib/bollingerPresentation.ts";

function signal(overrides = {}) {
  return {
    period: 20,
    sigma: 2,
    upper: 110,
    middle: 100,
    lower: 90,
    side: "LOWER_REBOUND",
    status: "NEAR",
    expectation: 38,
    distancePercent: 0.5,
    bandWidthPercent: 20,
    bandWalkRisk: "LOW",
    confirmations: [],
    warnings: [],
    ...overrides,
  };
}

test("bollinger無しとNONEは表示対象外", () => {
  assert.equal(isVisibleBollingerSignal(undefined), false);
  assert.equal(isVisibleBollingerSignal(signal({ side: "NONE", status: "NONE" })), false);
  assert.equal(isVisibleBollingerSignal(signal()), true);
});

test("LOWER_REBOUNDの全statusを日本語化", () => {
  assert.equal(getBollingerStatusLabel("LOWER_REBOUND", "NEAR"), "−2σ接近");
  assert.equal(getBollingerStatusLabel("LOWER_REBOUND", "TOUCHED"), "−2σ到達");
  assert.equal(getBollingerStatusLabel("LOWER_REBOUND", "BREACHED"), "−2σ割れ");
  assert.equal(getBollingerStatusLabel("LOWER_REBOUND", "CONFIRMED"), "−2σから反発確認");
});

test("UPPER_OVERHEATの全statusを日本語化", () => {
  assert.equal(getBollingerStatusLabel("UPPER_OVERHEAT", "NEAR"), "＋2σ接近");
  assert.equal(getBollingerStatusLabel("UPPER_OVERHEAT", "TOUCHED"), "＋2σ到達");
  assert.equal(getBollingerStatusLabel("UPPER_OVERHEAT", "BREACHED"), "＋2σ突破");
  assert.equal(getBollingerStatusLabel("UPPER_OVERHEAT", "CONFIRMED"), "＋2σから失速確認");
});

test("expectation段階と上下別ラベル", () => {
  assert.equal(getExpectationLevel(0), "弱い");
  assert.equal(getExpectationLevel(39), "弱い");
  assert.equal(getExpectationLevel(40), "やや注目");
  assert.equal(getExpectationLevel(60), "注目");
  assert.equal(getExpectationLevel(80), "強い");
  assert.equal(getBollingerExpectationLabel("LOWER_REBOUND"), "反発期待度");
  assert.equal(getBollingerExpectationLabel("UPPER_OVERHEAT"), "上側BB注目度");
  assert.equal(
    getBollingerExpectationLabel("UPPER_OVERHEAT", "UPPER_REVERSAL"),
    "過熱警戒度",
  );
});

test("UPPERを上昇継続・注目・失速警戒に分ける", () => {
  assert.equal(getBollingerTitle("UPPER_OVERHEAT", "UPPER_TREND"), "上側BB推移");
  assert.equal(getBollingerTitle("UPPER_OVERHEAT", "UPPER_WATCH"), "上側BB注目");
  assert.equal(getBollingerTitle("UPPER_OVERHEAT", "UPPER_REVERSAL"), "BB失速警戒");
  assert.match(
    buildBollingerComment(signal({
      side: "UPPER_OVERHEAT",
      upperRegime: "UPPER_TREND",
    })),
    /直ちに下落を示すものではありません/,
  );
  assert.match(
    buildBollingerComment(signal({
      side: "UPPER_OVERHEAT",
      upperRegime: "UPPER_WATCH",
    })),
    /明確な失速確認ではない/,
  );
  assert.match(
    buildBollingerComment(signal({
      side: "UPPER_OVERHEAT",
      upperRegime: "UPPER_REVERSAL",
    })),
    /過熱の兆候/,
  );
});

test("bandWalkRisk LOW / MEDIUM / HIGHを日本語化", () => {
  assert.equal(getBandWalkRiskLabel("LOW"), "低");
  assert.equal(getBandWalkRiskLabel("MEDIUM"), "中");
  assert.equal(getBandWalkRiskLabel("HIGH"), "高");
});

test("確認材料0件・複数件・HIGH・上側で説明を切り替える", () => {
  assert.match(buildBollingerComment(signal()), /短期反発の候補/);
  assert.match(
    buildBollingerComment(signal({ confirmations: ["RSI改善", "MACD改善"] })),
    /条件が整いつつあります/,
  );
  assert.match(
    buildBollingerComment(signal({ bandWalkRisk: "HIGH" })),
    /バンドウォークの可能性/,
  );
  assert.match(
    buildBollingerComment(signal({ side: "UPPER_OVERHEAT" })),
    /明確な失速確認ではない/,
  );
});

test("3画面が共通型・共通カードを使い、基礎スコア・順位・通知条件を変えない", () => {
  for (const file of [
    "app/scan/page.tsx",
    "app/ai-analysis/page.tsx",
    "app/analysis/[code]/page.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /BollingerSignalCard/);
    assert.match(source, /type \{ BollingerSignal \}/);
  }
  assert.match(
    readFileSync("app/components/bollinger/BollingerSignalCard.tsx", "utf8"),
    /AIランキングとは独立した日足BB情報/,
  );
  for (const file of [
    "app/lib/aiEngine.ts",
    "app/lib/learning/rankingEngine.ts",
    "app/lib/learning/notificationEngine.ts",
  ]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /bollinger|bbBonus/i);
  }
});
