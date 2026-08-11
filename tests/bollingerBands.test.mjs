import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateBollingerSnapshot,
  classifyBollingerPosition,
  evaluateDailyBollingerSignal,
} from "../app/lib/bollingerBands.ts";

const fixedBands = {
  period: 20,
  sigma: 2,
  middle: 100,
  upper: 110,
  lower: 90,
  width: 0.2,
  bandWidthPercent: 20,
};

function candle(close, overrides = {}, index = 0) {
  return {
    time: 1_700_000_000 + index * 86_400,
    open: close,
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume: 1_000,
    ...overrides,
  };
}

test("20期間・2σを母標準偏差で計算する", () => {
  const closes = Array.from({ length: 20 }, (_, index) => index + 1);
  const result = calculateBollingerSnapshot(closes);
  assert.ok(result);
  assert.equal(result.period, 20);
  assert.equal(result.sigma, 2);
  assert.ok(Math.abs(result.middle - 10.5) < 1e-12);
  assert.ok(Math.abs(result.upper - 22.032562594670797) < 1e-12);
  assert.ok(Math.abs(result.lower - -1.0325625946707966) < 1e-12);
});

test("日足不足と分散ゼロを安全に扱う", () => {
  assert.equal(calculateBollingerSnapshot(Array(19).fill(100)), null);
  assert.equal(
    evaluateDailyBollingerSignal(
      Array.from({ length: 19 }, (_, index) => candle(100, {}, index)),
    ),
    null,
  );
});

test("下側バンドのNEAR / TOUCHED / BREACHED / CONFIRMED境界", () => {
  assert.deepEqual(
    classifyBollingerPosition(candle(95, { low: 90.8 }), fixedBands, undefined, null),
    { side: "LOWER_REBOUND", status: "NEAR" },
  );
  assert.deepEqual(
    classifyBollingerPosition(candle(90, { low: 90 }), fixedBands, undefined, null),
    { side: "LOWER_REBOUND", status: "TOUCHED" },
  );
  assert.deepEqual(
    classifyBollingerPosition(candle(89, { low: 88 }), fixedBands, undefined, null),
    { side: "LOWER_REBOUND", status: "BREACHED" },
  );
  assert.deepEqual(
    classifyBollingerPosition(
      candle(92, { low: 89 }),
      fixedBands,
      undefined,
      null,
      { lower: true, upper: false },
    ),
    { side: "LOWER_REBOUND", status: "CONFIRMED" },
  );
});

test("上側バンドのNEAR / TOUCHED / BREACHED / CONFIRMED境界", () => {
  assert.deepEqual(
    classifyBollingerPosition(candle(105, { high: 108.9 }), fixedBands, undefined, null),
    { side: "UPPER_OVERHEAT", status: "NEAR" },
  );
  assert.deepEqual(
    classifyBollingerPosition(candle(110, { high: 110 }), fixedBands, undefined, null),
    { side: "UPPER_OVERHEAT", status: "TOUCHED" },
  );
  assert.deepEqual(
    classifyBollingerPosition(candle(111, { high: 112 }), fixedBands, undefined, null),
    { side: "UPPER_OVERHEAT", status: "BREACHED" },
  );
  assert.deepEqual(
    classifyBollingerPosition(
      candle(108, { high: 111 }),
      fixedBands,
      undefined,
      null,
      { lower: false, upper: true },
    ),
    { side: "UPPER_OVERHEAT", status: "CONFIRMED" },
  );
});

test("前日バンド外からの復帰も反転材料がなければTOUCHEDにする", () => {
  const previous = candle(89);
  assert.deepEqual(
    classifyBollingerPosition(candle(95), fixedBands, previous, fixedBands),
    { side: "LOWER_REBOUND", status: "TOUCHED" },
  );
});

test("前日バンド外からの復帰に反転材料があればCONFIRMEDにする", () => {
  const previous = candle(89);
  assert.deepEqual(
    classifyBollingerPosition(
      candle(95),
      fixedBands,
      previous,
      fixedBands,
      { lower: true, upper: false },
    ),
    { side: "LOWER_REBOUND", status: "CONFIRMED" },
  );
});

test("下降バンドウォークをHIGHとし期待度を抑える", () => {
  const candles = Array.from({ length: 90 }, (_, index) => {
    const acceleratedDrop = index < 80
      ? 160 - index * 0.35
      : 132 - (index - 79) ** 2 * 0.9;
    return candle(
      acceleratedDrop,
      {
        open: acceleratedDrop + 1,
        high: acceleratedDrop + 1.5,
        low: acceleratedDrop - 2,
        volume: index >= 85 ? 2_000 : 1_000,
      },
      index,
    );
  });
  const result = evaluateDailyBollingerSignal(candles, {
    supportResistanceStatus: "BREAKDOWN_RISK",
    patterns: [{
      id: "sell-test",
      name: "弱気テスト",
      direction: "SELL",
      confidence: 90,
      score: -20,
      reasons: [],
    }],
  });
  assert.ok(result);
  assert.equal(result.side, "LOWER_REBOUND");
  assert.equal(result.bandWalkRisk, "HIGH");
  assert.ok(result.expectation <= 35);
  assert.ok(result.warnings.includes("バンドウォークリスク高"));
});

test("強い上昇バンドウォークをUPPER_TRENDとして扱う", () => {
  const candles = Array.from({ length: 90 }, (_, index) => {
    const close = 100 + index * 0.2 + Math.max(0, index - 80) ** 2 * 0.3;
    return candle(close, {
      open: close - 1,
      high: close + 1,
      low: close - 1.5,
      volume: index === 89 ? 1_800 : 1_000,
    }, index);
  });
  const result = evaluateDailyBollingerSignal(candles);
  assert.ok(result);
  assert.equal(result.side, "UPPER_OVERHEAT");
  assert.equal(result.upperRegime, "UPPER_TREND");
  assert.notEqual(result.status, "CONFIRMED");
});

test("上側接触後の陰線と内側復帰をUPPER_REVERSALとして確認する", () => {
  const candles = Array.from({ length: 89 }, (_, index) => {
    const close = 100 + index * 0.6;
    return candle(close, {
      open: close - 1,
      high: close + 1,
      low: close - 1.5,
    }, index);
  });
  candles.push(candle(154, {
    open: 157,
    high: 160,
    low: 153,
    close: 154,
    volume: 1_800,
  }, 89));
  const result = evaluateDailyBollingerSignal(candles);
  assert.ok(result);
  assert.equal(result.status, "CONFIRMED");
  assert.equal(result.upperRegime, "UPPER_REVERSAL");
});

test("Phase 1接続は日足だけを渡し、AI POWER・順位・通知コードを変更しない", () => {
  const analyzer = readFileSync("app/lib/learning/stockAnalyzer.ts", "utf8");
  assert.match(analyzer, /evaluateDailyBollingerSignal\(dailyChart\.candles/);
  const aiScoreCall = analyzer.match(
    /const scored = calculateAiScore\(\{([\s\S]*?)\}\);/,
  );
  assert.ok(aiScoreCall);
  assert.doesNotMatch(aiScoreCall[1], /bollinger/i);

  const aiEngine = readFileSync("app/lib/aiEngine.ts", "utf8");
  const ranking = readFileSync("app/lib/learning/rankingEngine.ts", "utf8");
  const notification = readFileSync("app/lib/learning/notificationEngine.ts", "utf8");
  assert.doesNotMatch(aiEngine, /bollinger|bbBonus/i);
  assert.doesNotMatch(ranking, /bollinger|bbBonus/i);
  assert.doesNotMatch(notification, /bollinger|bbBonus/i);
});
