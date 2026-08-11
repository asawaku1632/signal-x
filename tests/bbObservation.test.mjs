import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const {
  getFutureTradingEvaluation,
  getObservationState,
  shouldCreateBbEvent,
} = await import("../app/lib/learning/bbObservationCore.ts");

function signal(overrides = {}) {
  return {
    period: 20,
    sigma: 2,
    upper: 110,
    middle: 100,
    lower: 90,
    side: "LOWER_REBOUND",
    status: "NEAR",
    expectation: 30,
    distancePercent: 0.5,
    bandWidthPercent: 20,
    bandWalkRisk: "LOW",
    confirmations: [],
    warnings: [],
    ...overrides,
  };
}

test("新規状態は保存し、同一状態の連続日は保存しない", () => {
  const current = getObservationState(signal());
  assert.equal(shouldCreateBbEvent(undefined, current), true);
  assert.equal(shouldCreateBbEvent(current, current), false);
});

test("statusまたはupperRegime変化は新規イベントにする", () => {
  const near = getObservationState(signal());
  const touched = getObservationState(signal({ status: "TOUCHED" }));
  assert.equal(shouldCreateBbEvent(near, touched), true);

  const trend = getObservationState(signal({
    side: "UPPER_OVERHEAT",
    upperRegime: "UPPER_TREND",
  }));
  const watch = getObservationState(signal({
    side: "UPPER_OVERHEAT",
    upperRegime: "UPPER_WATCH",
  }));
  assert.equal(shouldCreateBbEvent(trend, watch), true);
});

test("NONEで状態解除後の同一シグナル再発は新規イベントにする", () => {
  const active = getObservationState(signal());
  const none = getObservationState(signal({ side: "NONE", status: "NONE" }));
  assert.equal(none.active, false);
  assert.equal(shouldCreateBbEvent(active, none), false);
  assert.equal(shouldCreateBbEvent(none, active), true);
});

test("実在する取引日の1/5/10/20本後を評価する", () => {
  const dates = [
    "2026-04-24", "2026-04-27", "2026-04-28", "2026-04-30",
    "2026-05-01", "2026-05-07", "2026-05-08", "2026-05-11",
    "2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15",
    "2026-05-18", "2026-05-19", "2026-05-20", "2026-05-21",
    "2026-05-22", "2026-05-25", "2026-05-26", "2026-05-27", "2026-05-28",
  ];
  const candles = dates.map((tradeDate, index) => ({ tradeDate, close: 100 + index }));
  for (const horizon of [1, 5, 10, 20]) {
    const result = getFutureTradingEvaluation(candles, dates[0], horizon, 100);
    assert.equal(result.horizon, horizon);
    assert.equal(result.evaluatedTradeDate, dates[horizon]);
    assert.equal(result.futurePrice, 100 + horizon);
  }
  assert.equal(getFutureTradingEvaluation(candles, dates[10], 20, 110), null);
});

test("土日・祝日・欠損日は暦日加算せず価格データの本数で飛ばす", () => {
  const candles = [
    { tradeDate: "2026-05-01", close: 100 },
    { tradeDate: "2026-05-07", close: 105 },
  ];
  const result = getFutureTradingEvaluation(candles, "2026-05-01", 1, 100);
  assert.equal(result.evaluatedTradeDate, "2026-05-07");
  assert.ok(Math.abs(result.returnPercent - 5) < 1e-10);
});

test("Migrationがイベント・結果のDB冪等性を保証する", () => {
  const sql = readFileSync(
    "scripts/migrations/20260811_create_bb_signal_observation.sql",
    "utf8",
  );
  assert.match(sql, /UNIQUE \(code, signal_date, side, status, upper_regime\)/);
  assert.match(sql, /UNIQUE \(event_id, horizon\)/);
  assert.match(sql, /CHECK \(horizon IN \(1, 5, 10, 20\)\)/);
});

test("0補正・正負補正と補正前後AI POWERをイベントへ保存する", () => {
  const source = readFileSync("app/lib/learning/bbObservation.ts", "utf8");
  for (const field of [
    "bb_bonus", "raw_ai_power_before_bb", "raw_ai_power_after_bb",
    "display_ai_power_before_bb", "display_ai_power_after_bb",
  ]) assert.match(source, new RegExp(field));
  assert.match(source, /finite\(stock\.bbBonus\)/);
});

test("評価済みhorizonはDB制約とON CONFLICTで二重保存しない", () => {
  const source = readFileSync("app/lib/learning/bbObservation.ts", "utf8");
  assert.match(source, /bb_signal_event_results_idempotency_key/);
  assert.match(source, /DO NOTHING/);
});

test("AI POWER・ランキング・通知ルールを変更しない", () => {
  const bonus = readFileSync("app/lib/bollingerBonus.ts", "utf8");
  const ranking = readFileSync("app/lib/learning/rankingEngine.ts", "utf8");
  const notification = readFileSync("app/lib/learning/notificationEngine.ts", "utf8");
  assert.match(bonus, /BOLLINGER_BONUS_MIN = -3/);
  assert.match(bonus, /BOLLINGER_BONUS_MAX = 3/);
  assert.doesNotMatch(ranking, /bb_signal_events|bb_signal_event_results/);
  assert.doesNotMatch(notification, /bb_signal_events|bb_signal_event_results/);
});

test("Migration security is explicit and fails on object collisions", () => {
  const sql = readFileSync(
    "scripts/migrations/20260811_create_bb_signal_observation.sql",
    "utf8",
  );
  for (const table of [
    "bb_signal_events",
    "bb_signal_states",
    "bb_signal_event_results",
  ]) {
    assert.match(
      sql,
      new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
    );
  }
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE[\s\S]+FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON SEQUENCE[\s\S]+FROM PUBLIC, anon, authenticated, service_role/);
  assert.doesNotMatch(sql, /CREATE (?:TABLE|INDEX) IF NOT EXISTS/);
  assert.doesNotMatch(sql, /CREATE POLICY/);
});
