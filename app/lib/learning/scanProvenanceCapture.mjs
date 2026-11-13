import { createHash } from "node:crypto";
import { classifyScanProvenance } from "./scanProvenance.mjs";

// Deterministic, research-only capture builder. Does not write to DB or affect rankings.
// The caller must persist this object immutably *at scan time* before any outcome is known.
export function buildScanProvenanceCapture({ stock, generatedAt, modelVersion, learningAsOf = null }) {
  const code = String(stock?.code ?? "");
  if (!/^\d{4}$/.test(code)) throw new Error("INVALID_CODE");
  const timestamp = Date.parse(generatedAt);
  if (!Number.isFinite(timestamp)) throw new Error("INVALID_GENERATED_AT");
  const dataSource = stock.dataSource ?? null;
  const latestBarTimestamp = stock.latestBarTimestamp ?? null;
  const score = stock.rawAiPower ?? stock.aiPower ?? stock.score ?? null;
  const displayScore = stock.aiPower ?? stock.score ?? null;
  const finiteOrNull = (value) => value == null || !Number.isFinite(Number(value)) ? null : Number(value);
  const inputs = {
    code,
    generatedAt: new Date(timestamp).toISOString(),
    modelVersion: String(modelVersion ?? "UNKNOWN"),
    dataSource,
    latestBarTimestamp,
    learningAsOf,
    rawAiPower: finiteOrNull(score),
    displayAiPower: finiteOrNull(displayScore),
    referencePrice: finiteOrNull(stock.price),
    scoreBreakdown: stock.scoreBreakdown ?? null,
    patternKey: stock.patternKey ?? null,
    marketPattern: stock.marketPattern ?? null,
  };
  const inputFingerprintSha256 = createHash("sha256").update(JSON.stringify(inputs)).digest("hex");
  const timestampGate = classifyScanProvenance({ generatedAt, latestBarTimestamp, dataSource, learningAsOf });
  return {
    schema: "scan-provenance-capture-v1",
    ...inputs,
    inputFingerprintSha256,
    timestampGate,
    fullFeatureReplayVerified: false,
    predictionSuccessVerified: false,
    note: "Fingerprint covers only captured summary fields; not complete upstream feature inputs.",
  };
}
