import assert from "node:assert/strict";
import test from "node:test";
import { checkFinalizationEligibility, type FinalizationCandidate } from "./market-index-finalization-eligibility";

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
