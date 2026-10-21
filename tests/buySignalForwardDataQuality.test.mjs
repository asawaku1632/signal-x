import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBuySignalForward } from "../app/lib/research/buySignalForwardCore.mjs";

const sessions = Array.from({ length: 20 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
const base = { signalDate: "2026-10-30", signalPrice: 100, signalPriceVerified: true, signalPriceCorporateActionAdjusted: true, tradingDates: sessions };
const observation = (index, close, flags = {}) => ({
  tradeDate: sessions[index], close, verified: true, corporateActionAdjusted: true, ...flags,
});

test("missing checkpoint remains pending and never borrows a later price", () => {
  const result = evaluateBuySignalForward({ ...base, observations: [observation(0, 95), observation(3, 120)] });
  assert.equal(result.outcomes[1].status, "PENDING_OR_MISSING");
  assert.equal(result.outcomes[1].returnPct, null);
  assert.equal(result.firstCloseRecoverySession, null);
});

test("unverified or unadjusted checkpoint is never scored", () => {
  for (const flags of [{ verified: false }, { corporateActionAdjusted: false }]) {
    const result = evaluateBuySignalForward({ ...base, observations: [observation(0, 130, flags)] });
    assert.equal(result.outcomes[0].status, "UNVERIFIED");
    assert.equal(result.outcomes[0].returnPct, null);
    assert.equal(result.outcomes[0].recoveredToSignal, null);
  }
});

test("no trading calendar beyond coverage cannot yield 20-day result", () => {
  const result = evaluateBuySignalForward({ ...base, tradingDates: sessions.slice(0, 10), observations: [] });
  assert.equal(result.outcomes[4].status, "CALENDAR_UNAVAILABLE");
  assert.equal(result.outcomes[4].targetDate, null);
});

test("invalid prices and duplicate dates fail closed", () => {
  const result = evaluateBuySignalForward({ ...base, observations: [observation(0, 0)] });
  assert.equal(result.outcomes[0].status, "UNVERIFIED");
  assert.throws(() => evaluateBuySignalForward({ ...base, observations: [observation(0, 90), observation(0, 100)] }), /DUPLICATE/);
});

test("verified adjusted boundary prices are computed only at exact horizons", () => {
  const result = evaluateBuySignalForward({ ...base, observations: [
    observation(0, 90), observation(2, 95), observation(4, 98),
    observation(9, 100), observation(19, 110),
  ] });
  assert.deepEqual(result.outcomes.map((outcome) => outcome.horizon), [1, 3, 5, 10, 20]);
  assert.deepEqual(result.outcomes.map((outcome) => outcome.status), Array(5).fill("VERIFIED"));
  result.outcomes.forEach((outcome, index) => {
    assert.ok(Math.abs(outcome.returnPct - [-10, -5, -2, 0, 10][index]) < 1e-8);
  });
  assert.equal(result.firstCloseRecoverySession, null,
    "Path recovery must not be inferred when intermediate sessions are absent");
});

test("unverified first-day fall cannot become a confirmed recovery cohort", () => {
  const result = evaluateBuySignalForward({ ...base, observations: [
    observation(0, 80, { verified: false }), observation(2, 110),
  ] });
  assert.equal(result.outcomes[0].status, "UNVERIFIED");
  assert.equal(result.outcomes[0].returnPct, null);
  assert.equal(result.outcomes[1].status, "VERIFIED");
  assert.equal(result.firstCloseRecoverySession, null);
});

test("path drawdown halts at the first missing or unadjusted session", () => {
  const result = evaluateBuySignalForward({ ...base, observations: [
    observation(0, 95), observation(1, 90, { corporateActionAdjusted: false }),
    observation(2, 70), observation(3, 120),
  ] });
  assert.equal(result.worstCloseDrawdownPct, -5);
  assert.equal(result.firstCloseRecoverySession, null);
});

test("unverified or unadjusted signal baseline blocks all returns even when future closes are verified", () => {
  for (const flags of [{ signalPriceVerified: false }, { signalPriceCorporateActionAdjusted: false }]) {
    const result = evaluateBuySignalForward({ ...base, ...flags, observations: [
      observation(0, 95), observation(2, 110),
    ] });
    assert.equal(result.outcomes[0].status, "UNVERIFIED");
    assert.equal(result.outcomes[0].returnPct, null);
    assert.equal(result.outcomes[1].status, "UNVERIFIED");
    assert.equal(result.outcomes[1].recoveredToSignal, null);
    assert.equal(result.firstCloseRecoverySession, null);
    assert.equal(result.worstCloseDrawdownPct, null);
  }
});
