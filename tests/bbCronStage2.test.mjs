import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BB_EVALUATION_MAX_EVENTS,
  BB_SIGNAL_BATCH_SIZE,
  chunkBbItems,
  clampBbEvaluationOptions,
  findDuplicateCodes,
  getObservationState,
  shouldCreateBbEvent,
} from "../app/lib/learning/bbObservationCore.ts";
import { validateBbSnapshot } from "../app/lib/learning/bbCronValidation.ts";

const read = (file) => readFileSync(file, "utf8");

function codes(count) {
  return Array.from({ length: count }, (_, index) => String(1000 + index));
}

function validSnapshot(overrides = {}) {
  return {
    targetDate: "2026-08-14",
    updatedAt: "2026-08-14T06:48:30.000Z",
    itemCount: 966,
    stockCodes: codes(959),
    expectedCount: 966,
    savedDailyCount: 959,
    ...overrides,
  };
}

test("snapshot validation accepts current coverage and rejects unsafe inputs", () => {
  assert.equal(validateBbSnapshot(validSnapshot()).valid, true);
  assert.equal(validateBbSnapshot(validSnapshot({ updatedAt: "2026-08-13T06:48:30.000Z" })).reason, "SNAPSHOT_DATE_MISMATCH");
  assert.equal(validateBbSnapshot(validSnapshot({ itemCount: 20, stockCodes: codes(20) })).reason, "INSUFFICIENT_SNAPSHOT_COVERAGE");
  assert.equal(validateBbSnapshot(validSnapshot({ savedDailyCount: 0 })).reason, "DAILY_SNAPSHOT_NOT_SAVED");
  assert.equal(validateBbSnapshot(validSnapshot({ stockCodes: ["1000", "1000", ...codes(957)] })).reason, "DUPLICATE_SNAPSHOT_CODES");
});

test("959 to 1,000 rows are split into bounded batches", () => {
  assert.equal(BB_SIGNAL_BATCH_SIZE, 250);
  assert.deepEqual(chunkBbItems(codes(959)).map((batch) => batch.length), [250, 250, 250, 209]);
  assert.deepEqual(chunkBbItems(codes(1000)).map((batch) => batch.length), [250, 250, 250, 250]);
  assert.deepEqual(findDuplicateCodes(["1", "2", "1", "2"]), ["1", "2"]);
});

test("event transition rules remain unchanged", () => {
  const active = getObservationState({ side: "LOWER_REBOUND", status: "NEAR", upperRegime: "NONE" });
  const changed = getObservationState({ side: "LOWER_REBOUND", status: "TOUCHED", upperRegime: "NONE" });
  assert.equal(shouldCreateBbEvent(undefined, active), true);
  assert.equal(shouldCreateBbEvent(active, active), false);
  assert.equal(shouldCreateBbEvent(active, changed), true);
});

test("batched SQL preserves idempotency, transaction rollback, and old-date guard", () => {
  const source = read("app/lib/learning/bbObservation.ts");
  assert.match(source, /ON CONFLICT ON CONSTRAINT bb_signal_events_idempotency_key DO NOTHING/);
  assert.match(source, /ON CONFLICT \(code\) DO UPDATE/);
  assert.match(source, /last_seen_trade_date <= EXCLUDED\.last_seen_trade_date/);
  assert.match(source, /await client\.query\("BEGIN"\)/);
  assert.match(source, /await client\.query\("ROLLBACK"\)/);
  assert.match(source, /for \(const batch of chunkBbItems\(stocks, batchSize\)\)/);
});

test("evaluation limits are clamped to the approved safety envelope", () => {
  const limits = clampBbEvaluationOptions({
    limit: 1_000,
    concurrency: 100,
    requestTimeoutMs: 60_000,
    timeBudgetMs: 300_000,
  });
  assert.equal(BB_EVALUATION_MAX_EVENTS, 40);
  assert.deepEqual(limits, {
    limit: 40,
    concurrency: 5,
    requestTimeoutMs: 10_000,
    timeBudgetMs: 110_000,
  });
  const source = read("app/lib/learning/bbObservation.ts");
  assert.match(source, /apiFailed: true/);
  assert.match(source, /budgetSkipped: true/);
  assert.match(source, /remainingExpected/);
  assert.doesNotMatch(source, /retry/i);
});

test("signal cron uses the saved snapshot, never scans or evaluates, and has its own lease", () => {
  const route = read("app/api/cron/bb-observation/route.ts");
  const lock = read("app/lib/learning/bbObservationLock.ts");
  assert.match(route, /getLatestScanSnapshot/);
  assert.match(route, /daily_stock_results/);
  assert.doesNotMatch(route, /\/api\/scan|evaluatePendingBbEvents|runBbObservation/);
  assert.match(lock, /signalx-bb-observation:/);
  assert.doesNotMatch(lock, /signalx-save-daily:/);
  assert.match(lock, /expires_at <= NOW\(\)/);
  assert.match(route, /reason: "ALREADY_RUNNING"/);
});

test("required BB stages are persisted and evaluation is independently callable", () => {
  const route = read("app/api/cron/bb-observation/route.ts");
  for (const stage of [
    "BB_RECEIVED", "BB_STARTED", "BB_SNAPSHOT_VALIDATED",
    "BB_SIGNAL_SAVE_STARTED", "BB_SIGNAL_SAVE_COMPLETED",
    "BB_BEFORE_COMPLETED", "BB_COMPLETED", "BB_ERROR", "BB_SKIPPED",
  ]) assert.match(route, new RegExp(stage));
  const evaluationRoute = read("app/api/cron/bb-evaluation/route.ts");
  assert.match(evaluationRoute, /evaluatePendingBbEvents/);
  assert.match(evaluationRoute, /maxDuration = 120/);
});

test("save-daily remains completely isolated from BB code", () => {
  const source = read("app/api/learning/save-daily/route.ts");
  assert.doesNotMatch(source, /bbObservation|saveBbSignalEvents|evaluatePendingBbEvents/);
});
