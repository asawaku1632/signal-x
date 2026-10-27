/** Research-only BB provenance extraction. No writes or production hooks. */
export type BbSourceStock = {
  code?: unknown;
  price?: unknown;
  latestBarTimestamp?: unknown;
  dataSource?: unknown;
  bollinger?: { tradeDate?: unknown; side?: unknown; status?: unknown };
};
export function inspectBbSourceStock(stock: BbSourceStock, snapshotUpdatedAt: string, targetDate: string) {
  const quoteSeconds = typeof stock.latestBarTimestamp === "number" && Number.isFinite(stock.latestBarTimestamp)
    ? stock.latestBarTimestamp : null;
  const quoteAt = quoteSeconds !== null && quoteSeconds > 0
    ? new Date(quoteSeconds * 1000).toISOString() : null;
  const capturedAt = Number.isFinite(Date.parse(snapshotUpdatedAt)) ? new Date(snapshotUpdatedAt).toISOString() : null;
  const source = typeof stock.dataSource === "string" ? stock.dataSource : null;
  const signalDate = typeof stock.bollinger?.tradeDate === "string" ? stock.bollinger.tradeDate : null;
  const gaps = [
    ...(!quoteAt ? ["MISSING_QUOTE_TIMESTAMP"] : []),
    ...(!capturedAt ? ["MISSING_SNAPSHOT_TIMESTAMP"] : []),
    ...(!source ? ["MISSING_SOURCE_MODE"] : []),
    ...(signalDate !== targetDate ? ["TRADE_DATE_MISMATCH"] : []),
    "MISSING_INDEPENDENT_SIGNAL_GENERATED_AT",
    "MISSING_VERIFIED_PROVIDER_AND_LICENSE",
    "MISSING_BAR_END_AT"
  ];
  return {
    code: String(stock.code ?? ""), quoteAt, snapshotUpdatedAt: capturedAt,
    sourceMode: source, signalDate, signalSide: stock.bollinger?.side ?? null,
    signalStatus: stock.bollinger?.status ?? null, evidenceEligible: false,
    reasons: gaps
  };
}
