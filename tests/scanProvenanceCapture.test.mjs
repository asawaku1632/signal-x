import test from "node:test";
import assert from "node:assert/strict";
import { buildScanProvenanceCapture } from "../app/lib/learning/scanProvenanceCapture.mjs";

const sample = {
  stock: { code: "2501", rawAiPower: 92, aiPower: 88.9, price: 2162, dataSource: "intraday", latestBarTimestamp: Date.parse("2026-11-12T00:00:00Z") / 1000, scoreBreakdown: { trend: 7 }, patternKey: "UP" },
  generatedAt: "2026-11-13T00:06:29Z",
  modelVersion: "V20.0",
};
test("archived previous-day candle fails post-09:05 research gate", () => {
  const x = buildScanProvenanceCapture(sample);
  assert.equal(x.rawAiPower, 92);
  assert.equal(x.displayAiPower, 88.9);
  assert.equal(x.timestampGate.reason, "STALE_BAR");
  assert.equal(x.predictionSuccessVerified, false);
  assert.equal(x.fullFeatureReplayVerified, false);
});
test("identical inputs produce identical fingerprints", () => {
  assert.equal(buildScanProvenanceCapture(sample).inputFingerprintSha256, buildScanProvenanceCapture(sample).inputFingerprintSha256);
});
test("changed score changes fingerprint", () => {
  const changed = { ...sample, stock: { ...sample.stock, rawAiPower: 93 } };
  assert.notEqual(buildScanProvenanceCapture(sample).inputFingerprintSha256, buildScanProvenanceCapture(changed).inputFingerprintSha256);
});
test("missing learning timestamp remains unverified even with fresh intraday", () => {
  const x = buildScanProvenanceCapture({ ...sample, stock: { ...sample.stock, latestBarTimestamp: Date.parse("2026-11-13T00:06:00Z") / 1000 } });
  assert.equal(x.timestampGate.reason, "MISSING_LEARNING_ASOF");
});
test("reject malformed code and generation time", () => {
  assert.throws(() => buildScanProvenanceCapture({ ...sample, stock: { ...sample.stock, code: "x" } }), /INVALID_CODE/);
  assert.throws(() => buildScanProvenanceCapture({ ...sample, generatedAt: "bad" }), /INVALID_GENERATED_AT/);
});
