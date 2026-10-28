import test from "node:test";
import assert from "node:assert/strict";
import { validateScanFeatureCapture } from "../../app/lib/learning/scanFeatureCaptureValidation.mjs";

const valid = { code: "9984", scanRunId: "run-1", scanReceivedAt: "2026-10-27T06:35:00Z", sourceBarAt: "2026-10-27T06:30:00Z", aiPower: 78, entryPrice: 5000, cached: false };
test("valid data is only an as-of candidate", () => {
  assert.deepEqual(validateScanFeatureCapture(valid), { eligible: true, reason: "ASOF_CANDIDATE" });
});
for (const [name, change, reason] of [
  ["missing source time", {sourceBarAt: null}, "MISSING_OR_INVALID_TIMESTAMP"],
  ["future source time", {sourceBarAt: "2026-10-28T06:30:00Z"}, "FUTURE_SOURCE_BAR"],
  ["stale source", {sourceBarAt: "2026-10-25T06:30:00Z"}, "STALE_SOURCE_BAR"],
  ["cached scan", {cached: true}, "CACHED_SCAN"],
  ["invalid AI POWER", {aiPower: 101}, "INVALID_AI_POWER"],
  ["invalid price", {entryPrice: 0}, "INVALID_ENTRY_PRICE"],
  ["missing run identity", {scanRunId: ""}, "INVALID_IDENTITY"],
]) test(name, () => assert.equal(validateScanFeatureCapture({...valid, ...change}).reason, reason));

test("alphanumeric listed stock code is eligible for as-of candidate validation",()=>{
 assert.equal(validateScanFeatureCapture({...valid,code:"590A"}).eligible,true);
});
