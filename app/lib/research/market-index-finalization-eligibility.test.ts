import assert from "node:assert/strict";
import test from "node:test";
import { checkFinalizationEligibility, type FinalizationCandidate } from "./market-index-finalization-eligibility.ts";

const candidate: FinalizationCandidate = {
  indexKey: "nikkei",
  sessionDate: "2026-10-23",
  sourceRunId: "synthetic-run",
  providerId: "synthetic-provider",
  providerRightsVerified: true,
  rightsEvidenceId: "synthetic-evidence-not-real-permission",
  status: "available",
  observedAt: "2026-10-23T15:00:00+09:00",
  value: 40000,
  exchangeSessionVerified: true,
};

function reject(patch: Partial<FinalizationCandidate>, reason: string) {
  assert.deepEqual(checkFinalizationEligibility({ ...candidate, ...patch }), { eligible: false, reason });
}

test("synthetic complete candidate passes the pure contract (NOT a real provider authorization)", () => {
  assert.deepEqual(checkFinalizationEligibility(candidate), { eligible: true, key: "nikkei:2026-10-23" });
  assert.deepEqual(checkFinalizationEligibility({ ...candidate, indexKey: "topix" }), { eligible: true, key: "topix:2026-10-23" });
});

test("reject unsupported index and absent rights evidence", () => {
  reject({ indexKey: "other" }, "INVALID_INDEX");
  reject({ providerRightsVerified: false }, "PROVIDER_RIGHTS_UNVERIFIED");
  reject({ rightsEvidenceId: "" }, "PROVIDER_RIGHTS_UNVERIFIED");
});

test("reject missing calendar verdict and invalid dates", () => {
  reject({ exchangeSessionVerified: false }, "SESSION_UNVERIFIED");
  reject({ sessionDate: "2026-02-30" }, "SESSION_UNVERIFIED");
  reject({ sessionDate: "2026-10-23T00:00:00Z" }, "SESSION_UNVERIFIED");
});

test("reject missing prices and unavailable status", () => {
  reject({ status: "unavailable" }, "OBSERVATION_UNAVAILABLE");
  reject({ value: 0 }, "OBSERVATION_UNAVAILABLE");
  reject({ value: Number.NaN }, "OBSERVATION_UNAVAILABLE");
  reject({ value: Number.POSITIVE_INFINITY }, "OBSERVATION_UNAVAILABLE");
});

test("reject missing source or invalid timestamp", () => {
  reject({ observedAt: "2026-10-23T15:00:00" }, "TIMESTAMP_UNVERIFIED");
  reject({ observedAt: "invalid" }, "TIMESTAMP_UNVERIFIED");
  reject({ sourceRunId: "" }, "SOURCE_UNVERIFIED");
  reject({ providerId: "" }, "SOURCE_UNVERIFIED");
});

test("reject truthy substitutes for trusted verification flags", () => {
  reject({ providerRightsVerified: "true" }, "PROVIDER_RIGHTS_UNVERIFIED");
  reject({ exchangeSessionVerified: 1 }, "SESSION_UNVERIFIED");
  reject({ rightsEvidenceId: "   " }, "PROVIDER_RIGHTS_UNVERIFIED");
});

test("reject malformed calendar days and negative observations", () => {
  reject({ sessionDate: "2026-13-01" }, "SESSION_UNVERIFIED");
  reject({ sessionDate: "2026-02-29" }, "SESSION_UNVERIFIED");
  reject({ value: -100 }, "OBSERVATION_UNAVAILABLE");
  reject({ value: "40000" }, "OBSERVATION_UNAVAILABLE");
});

test("fail closed on malformed top-level input", () => {
  assert.deepEqual(checkFinalizationEligibility(null as unknown as FinalizationCandidate), { eligible: false, reason: "INVALID_CANDIDATE" });
  assert.deepEqual(checkFinalizationEligibility(undefined as unknown as FinalizationCandidate), { eligible: false, reason: "INVALID_CANDIDATE" });
});

test("reject absent required fields without throwing", () => {
  reject({ indexKey: null }, "INVALID_INDEX");
  reject({ sessionDate: null }, "SESSION_UNVERIFIED");
  reject({ status: null }, "OBSERVATION_UNAVAILABLE");
  reject({ observedAt: null }, "TIMESTAMP_UNVERIFIED");
  reject({ sourceRunId: null }, "SOURCE_UNVERIFIED");
});

test("accept explicit UTC timestamps and reject timezone-free ones", () => {
  assert.deepEqual(checkFinalizationEligibility({ ...candidate, observedAt: "2026-10-23T06:00:00Z" }), { eligible: true, key: "nikkei:2026-10-23" });
  reject({ observedAt: "2026-10-23T06:00:00" }, "TIMESTAMP_UNVERIFIED");
});

test("fail closed for structurally invalid input objects", () => {
  assert.deepEqual(checkFinalizationEligibility([] as unknown as FinalizationCandidate), { eligible: false, reason: "INVALID_INDEX" });
  assert.deepEqual(checkFinalizationEligibility({} as FinalizationCandidate), { eligible: false, reason: "INVALID_INDEX" });
});

test("reject non-boolean rights and session verification", () => {
  reject({ providerRightsVerified: 1 }, "PROVIDER_RIGHTS_UNVERIFIED");
  reject({ providerRightsVerified: null }, "PROVIDER_RIGHTS_UNVERIFIED");
  reject({ exchangeSessionVerified: "true" }, "SESSION_UNVERIFIED");
  reject({ exchangeSessionVerified: null }, "SESSION_UNVERIFIED");
});

test("reject non-string provenance and unsupported status", () => {
  reject({ rightsEvidenceId: 123 }, "PROVIDER_RIGHTS_UNVERIFIED");
  reject({ providerId: 123 }, "SOURCE_UNVERIFIED");
  reject({ sourceRunId: "  " }, "SOURCE_UNVERIFIED");
  reject({ status: "pending" }, "OBSERVATION_UNAVAILABLE");
});

test("does not mutate the input candidate", () => {
  const frozen = Object.freeze({ ...candidate });
  assert.deepEqual(checkFinalizationEligibility(frozen), { eligible: true, key: "nikkei:2026-10-23" });
  assert.deepEqual(frozen, candidate);
});
