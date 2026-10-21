import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBuySignalForward } from "../app/lib/research/buySignalForwardCore.mjs";

const sessions = Array.from({ length: 20 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
const base = { signalDate: "2026-10-30", signalPrice: 100, tradingDates: sessions };
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
