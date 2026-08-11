import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BOLLINGER_BONUS_MAX,
  BOLLINGER_BONUS_MIN,
  calculateBollingerBonus,
} from "../app/lib/bollingerBonus.ts";
import {
  calculateDisplayAiPower,
  calculateRawAiPower,
} from "../app/lib/aiPowerEngine.ts";

function signal(overrides = {}) {
  return {
    period: 20,
    sigma: 2,
    upper: 110,
    middle: 100,
    lower: 90,
    side: "LOWER_REBOUND",
    status: "CONFIRMED",
    expectation: 65,
    distancePercent: -0.2,
    bandWidthPercent: 20,
    bandWalkRisk: "LOW",
    confirmations: ["確認材料"],
    warnings: [],
    ...overrides,
  };
}

test("LOWERのNEARとTOUCHEDは補正しない", () => {
  assert.equal(calculateBollingerBonus(signal({ status: "NEAR" })).bonus, 0);
  assert.equal(calculateBollingerBonus(signal({ status: "TOUCHED" })).bonus, 0);
});

test("LOWER CONFIRMEDはLOWで最大3、MEDIUMで1", () => {
  assert.equal(calculateBollingerBonus(signal()).bonus, 3);
  assert.equal(
    calculateBollingerBonus(signal({ expectation: 59 })).bonus,
    2,
  );
  assert.equal(
    calculateBollingerBonus(signal({ bandWalkRisk: "MEDIUM" })).bonus,
    1,
  );
});

test("LOWER HIGHはCONFIRMEDでもプラス補正しない", () => {
  assert.equal(
    calculateBollingerBonus(signal({ bandWalkRisk: "HIGH", expectation: 100 })).bonus,
    0,
  );
});

test("UPPER_TRENDとUPPER_WATCHは補正しない", () => {
  for (const upperRegime of ["UPPER_TREND", "UPPER_WATCH"]) {
    assert.equal(
      calculateBollingerBonus(signal({
        side: "UPPER_OVERHEAT",
        upperRegime,
        status: "BREACHED",
      })).bonus,
      0,
    );
  }
});

test("UPPER_REVERSAL CONFIRMEDだけを小さく減点する", () => {
  assert.equal(
    calculateBollingerBonus(signal({
      side: "UPPER_OVERHEAT",
      upperRegime: "UPPER_REVERSAL",
      status: "CONFIRMED",
      expectation: 59,
    })).bonus,
    -2,
  );
  assert.equal(
    calculateBollingerBonus(signal({
      side: "UPPER_OVERHEAT",
      upperRegime: "UPPER_REVERSAL",
      status: "CONFIRMED",
      expectation: 60,
    })).bonus,
    -3,
  );
});

test("bbBonusは常に-3から+3に収まる", () => {
  assert.equal(BOLLINGER_BONUS_MIN, -3);
  assert.equal(BOLLINGER_BONUS_MAX, 3);
  const cases = [
    signal(),
    signal({ bandWalkRisk: "MEDIUM" }),
    signal({ side: "UPPER_OVERHEAT", upperRegime: "UPPER_REVERSAL" }),
  ];
  for (const item of cases) {
    const { bonus } = calculateBollingerBonus(item);
    assert.ok(bonus >= BOLLINGER_BONUS_MIN && bonus <= BOLLINGER_BONUS_MAX);
  }
});

test("無効時と非対象時は旧AI POWERに完全一致し、表示は0から100", () => {
  const baseInput = { baseScore: 84, marketBonus: 2 };
  const oldRaw = calculateRawAiPower(baseInput);
  const disabled = calculateBollingerBonus(signal(), false);
  const inactive = calculateBollingerBonus(signal({ status: "NEAR" }));
  assert.equal(calculateRawAiPower({ ...baseInput, bbBonus: disabled.bonus }), oldRaw);
  assert.equal(calculateRawAiPower({ ...baseInput, bbBonus: inactive.bonus }), oldRaw);
  assert.equal(calculateDisplayAiPower(-5), 0);
  assert.ok(calculateDisplayAiPower(1_000) <= 100);
});

test("ランキングと通知の条件ロジック自体は変更しない", () => {
  const ranking = readFileSync("app/lib/learning/rankingEngine.ts", "utf8");
  const notification = readFileSync("app/lib/learning/notificationEngine.ts", "utf8");
  assert.doesNotMatch(ranking, /bbBonus|bollinger/i);
  assert.doesNotMatch(notification, /bbBonus|bollinger/i);
  assert.match(ranking, /rawAiPower/);
  assert.match(notification, /HOT_SCORE_MIN = 95/);
  assert.match(notification, /STRONG_SCORE_MIN = 85/);
  assert.match(notification, /WATCH_SCORE_MIN = 75/);
});
