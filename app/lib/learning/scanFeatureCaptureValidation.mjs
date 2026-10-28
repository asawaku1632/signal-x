// Research-only validation. No database writes or production integration.
export function validateScanFeatureCapture(input) {
  if (!input || typeof input !== "object") return { eligible: false, reason: "INVALID_INPUT" };
  const { code, scanRunId, scanReceivedAt, sourceBarAt, aiPower, entryPrice, cached } = input;
  if (typeof code !== "string" || !/^(?:[0-9]{4,5}|[0-9]{3}[A-Z])$/.test(code) ||
      typeof scanRunId !== "string" || !scanRunId.trim())
    return { eligible: false, reason: "INVALID_IDENTITY" };
  const received = Date.parse(scanReceivedAt);
  const source = Date.parse(sourceBarAt);
  if (typeof scanReceivedAt !== "string" || !Number.isFinite(received) ||
      typeof sourceBarAt !== "string" || !Number.isFinite(source))
    return { eligible: false, reason: "MISSING_OR_INVALID_TIMESTAMP" };
  if (source > received) return { eligible: false, reason: "FUTURE_SOURCE_BAR" };
  if (cached === true) return { eligible: false, reason: "CACHED_SCAN" };
  if (received - source > 24 * 60 * 60 * 1000)
    return { eligible: false, reason: "STALE_SOURCE_BAR" };
  if (typeof aiPower !== "number" || !Number.isFinite(aiPower) || aiPower < 0 || aiPower > 100)
    return { eligible: false, reason: "INVALID_AI_POWER" };
  if (typeof entryPrice !== "number" || !Number.isFinite(entryPrice) || entryPrice <= 0)
    return { eligible: false, reason: "INVALID_ENTRY_PRICE" };
  return { eligible: true, reason: "ASOF_CANDIDATE" };
}
