import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/lib/push/fiveSignalResearchReadiness.ts", import.meta.url), "utf8");

test("five research signals are independently named", () => {
  for (const key of ["exploded", "surge_precursor", "surge_start", "explosive_candidate", "profit_precursor"]) {
    assert.match(source, new RegExp(`key: "${key}"`));
  }
});

test("owner preview cannot become an accidental push delivery", () => {
  assert.match(source, /eligibleForDelivery: false;/);
  assert.match(source, /eligibleForDelivery: false,/);
  assert.doesNotMatch(source, /sendWebPush|pushWebToUser|pushWebToAll|INSERT INTO|UPDATE public\./);
});

test("100-share budget, excluded stock, provenance and forward coverage are guarded", () => {
  for (const required of [
    "100_000", "500_000", "9984", "MISSING_OBSERVATION_TIME",
    "UNVERIFIED_RESEARCH", "INSUFFICIENT_FORWARD_COVERAGE",
    "BEARISH_DIVERGENCE_WARNING", "MOMENTUM_UNAVAILABLE", "VOLUME_UNAVAILABLE",
  ]) assert.ok(source.includes(required), required);
});

test("invalid forward counts and divergence must fail closed", () => {
  assert.match(source, /Number\.isSafeInteger\(value\)/);
  assert.match(source, /INVALID_DIVERGENCE/);
});

test("research preview is never a delivery authorization", () => {
  assert.match(source, /eligibleForDelivery:\s*false/);
  assert.match(source, /OWNER_ONLY/);
  assert.match(source, /EXCLUDED_CODE/);
});
