import { randomUUID } from "node:crypto";
import { buildGeneratedScanResearchEnvelope } from "./buildGeneratedScanResearchEnvelope.mjs";

// Offline adapter for a fresh Scan result captured by a development caller.
// No calls to runScan or production routes. Timestamps must originate at execution.
export function createGeneratedScanResearchArtifact(execution) {
  if (!execution || typeof execution !== "object")
    return {accepted:false,reason:"INVALID_SCAN_EXECUTION",artifact:null};
  const {scanResult,scanStartedAt,scanCompletedAt,scanRunId=randomUUID()} = execution;
  const completed = Date.parse(scanCompletedAt);
  if (!Number.isFinite(completed)) return { accepted:false, reason:"INVALID_COMPLETION_TIME", artifact:null };
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit"
  }).formatToParts(new Date(completed));
  const dates = Object.fromEntries(dateParts.map(x=>[x.type,x.value]));
  const tradeDate = `${dates.year}-${dates.month}-${dates.day}`;
  if (!scanResult || !Array.isArray(scanResult.stocks) ||
      scanResult.diagnostics?.analyzedFailureCount !== 0 ||
      scanResult.diagnostics?.analyzedSuccessCount !== scanResult.stocks.length ||
      scanResult.diagnostics?.targetStockCount !== scanResult.stocks.length)
    return { accepted:false, reason:"INCOMPLETE_SCAN_EXECUTION", artifact:null };
  const artifact = {
    scanRunId, tradeDate, scanStartedAt, scanCompletedAt,
    payload:{cached:false,updatedAt:scanCompletedAt,stocks:scanResult.stocks}
  };
  const result = buildGeneratedScanResearchEnvelope(artifact);
  return result.accepted
    ? {accepted:true,reason:"OFFLINE_UNVERIFIED_ARTIFACT",artifact}
    : {accepted:false,reason:result.reason,artifact:null};
}
