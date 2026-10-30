import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const moduleUrl = new URL("../app/lib/push/fiveSignalResearchReadiness.ts", import.meta.url).href;

function evaluate(overrides = {}) {
  const input = {
    signal: "surge_precursor",
    code: "7203",
    observedAt: "2026-10-30T15:00:00+09:00",
    priceYen: 2500,
    volumeRatio20d: 1.8,
    momentumPct: 3.1,
    divergence: "NONE",
    evidenceVerified: true,
    completedForwardDays: 20,
    completedForwardCodes: 40,
    completedForwardObservations: 80,
    isOwner: true,
    ...overrides,
  };
  const script = `import { evaluateFiveSignalResearchAlert } from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(evaluateFiveSignalResearchAlert(${JSON.stringify(input)})))`;
  return JSON.parse(execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], {
    encoding: "utf8",
    timeout: 10_000,
    stdio: ["ignore", "pipe", "pipe"],
  }));
}

test("research-only owner preview remains non-deliverable even with full evidence", () => {
  const result = evaluate();
  assert.equal(result.eligibleForOwnerPreview, true);
  assert.equal(result.eligibleForDelivery, false);
  assert.equal(result.budgetYen, 250000);
});

test("non-owner and excluded 9984 are never previewable", () => {
  for (const overrides of [{ isOwner: false }, { code: "9984" }]) {
    assert.equal(evaluate(overrides).eligibleForOwnerPreview, false);
  }
});

test("100-share purchase budget boundaries", () => {
  assert.equal(evaluate({ priceYen: 1000 }).budgetYen, 100000);
  assert.equal(evaluate({ priceYen: 5000 }).budgetYen, 500000);
  for (const priceYen of [999, 5001, 0, null, -5]) {
    assert.equal(evaluate({ priceYen }).eligibleForOwnerPreview, false);
  }
});

test("missing observation timestamp and invalid samples fail closed", () => {
  assert.equal(evaluate({ observedAt: null }).eligibleForOwnerPreview, false);
  for (const completedForwardDays of [-1, 1.5, null, "20"]) {
    assert.ok(evaluate({ completedForwardDays }).reasons.includes("INVALID_FORWARD_COUNTS"));
  }
});

test("bearish divergence, unknown momentum, and unverified research never permit delivery", () => {
  for (const overrides of [
    { divergence: "BEARISH" },
    { momentumPct: null },
    { evidenceVerified: false },
  ]) {
    assert.equal(evaluate(overrides).eligibleForDelivery, false);
  }
});

test("unknown signal is rejected from owner preview", () => {
  const result = evaluate({ signal: "other" });
  assert.equal(result.eligibleForOwnerPreview, false);
  assert.ok(result.reasons.includes("UNKNOWN_SIGNAL"));
});

test("timezone-free timestamp is rejected", () => {
  const result = evaluate({ observedAt: "2026-10-30T15:00:00" });
  assert.equal(result.eligibleForOwnerPreview, false);
  assert.ok(result.reasons.includes("MISSING_OBSERVATION_TIME"));
});

test("invalid volume ratio cannot pass the gate", () => {
  const result = evaluate({ volumeRatio20d: -2 });
  assert.ok(result.reasons.includes("INVALID_VOLUME_RATIO"));
  assert.equal(result.eligibleForOwnerPreview, false);
});

test("malformed forward coverage never enters owner preview", () => {
  for (const completedForwardObservations of [-1, 1.5, null]) {
    const result = evaluate({ completedForwardObservations });
    assert.ok(result.reasons.includes("INVALID_FORWARD_COUNTS"));
    assert.equal(result.eligibleForOwnerPreview, false);
  }
});

test("future observations fail closed", () => {
  assert.ok(evaluate({ observedAt: "2099-01-01T00:00:00Z" }).reasons.includes("FUTURE_OBSERVATION_TIME"));
});

test("fractional purchase price is not rounded into budget", () => {
  const result = evaluate({ priceYen: 999.999 });
  assert.equal(result.eligibleForOwnerPreview, false);
  assert.ok(result.reasons.includes("OUTSIDE_100_SHARE_BUDGET"));
});
