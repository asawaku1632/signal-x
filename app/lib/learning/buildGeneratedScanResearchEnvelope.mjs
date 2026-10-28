// Research-only builder for the point where a new Scan payload is constructed.
// Pure: never writes a database or changes a live snapshot. Caller must supply
// independently captured timestamps and use a verified provider separately.
export function buildGeneratedScanResearchEnvelope(input) {
  if (!input || typeof input !== "object") return { accepted:false, reason:"INVALID_GENERATION_INPUT", envelope:null };
  const { scanRunId, tradeDate, scanStartedAt, scanCompletedAt, payload } = input;
  const fail = reason => ({ accepted: false, reason, envelope: null });
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.stocks) || payload.stocks.length === 0)
    return fail("EMPTY_GENERATED_SCAN");
  if (typeof scanRunId !== "string" || !scanRunId.trim() || typeof tradeDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(tradeDate) ||
      Number.isNaN(Date.parse(tradeDate+"T00:00:00Z")) ||
      new Date(tradeDate+"T00:00:00Z").toISOString().slice(0,10) !== tradeDate)
    return fail("INVALID_RUN_IDENTITY");
  const validTime=t=>typeof t==="string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(t) && Number.isFinite(Date.parse(t));
  if (!validTime(scanStartedAt) || !validTime(scanCompletedAt) || Date.parse(scanStartedAt)>Date.parse(scanCompletedAt))
    return fail("INVALID_GENERATION_WINDOW");
  if (payload.cached !== false) return fail("CACHED_NOT_GENERATED");
  if (!validTime(payload.updatedAt) || Date.parse(payload.updatedAt)<Date.parse(scanStartedAt) ||
      Date.parse(payload.updatedAt)>Date.parse(scanCompletedAt))
    return fail("UPDATED_AT_OUTSIDE_GENERATION");
  const stocks = payload.stocks.map(stock=>({
    code: stock?.code, price: stock?.price, aiPower: stock?.aiPower,
    score: stock?.score, latestBarTimestamp: stock?.latestBarTimestamp,
    dataSource: stock?.dataSource, patternLearning: stock?.patternLearning && typeof stock.patternLearning === "object" ? structuredClone(stock.patternLearning) : null,
    patternKey: stock?.patternKey
  }));
  return { accepted:true, reason:"GENERATED_UNVERIFIED", envelope:{
    scanRunId, tradeDate, scanStartedAt, scanReceivedAt:scanCompletedAt,
    scanResponse:{cached:false,status:"fresh",stocks},
    // This is observational metadata, not proof of as-of feature lineage.
    provenance_verified:false, provider_license_verified:false
  }};
}
