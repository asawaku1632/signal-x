import { validateScanFeatureCapture } from "./scanFeatureCaptureValidation.mjs";

// Research-only preparation; does not query or write any database.
export function prepareScanFeatureCaptures({ scanRunId, tradeDate, scanReceivedAt, scanResponse }) {
  const stocks = Array.isArray(scanResponse?.stocks) ? scanResponse.stocks : [];
  const cached = scanResponse?.cached === true;
  const rows = [];
  const seen = new Set();
  for (const stock of stocks) {
    const code = typeof stock?.code === "string" ? stock.code : String(stock?.code ?? "");
    const rawBarTime = stock?.latestBarTimestamp;
    const barMillis = typeof rawBarTime === "number" && Number.isFinite(rawBarTime)
      ? (rawBarTime < 1e11 ? rawBarTime * 1000 : rawBarTime)
      : NaN;
    const sourceBarAt = Number.isFinite(barMillis) && Number.isFinite(new Date(barMillis).getTime())
      ? new Date(barMillis).toISOString()
      : null;
    const aiPower = stock?.aiPower ?? stock?.score;
    const entryPrice = stock?.price;
    const result = validateScanFeatureCapture({ code, scanRunId, scanReceivedAt, sourceBarAt, aiPower, entryPrice, cached });
    const duplicate = seen.has(code);
    seen.add(code);
    rows.push({
      scan_run_id: scanRunId,
      trade_date: tradeDate,
      code,
      scan_received_at: scanReceivedAt,
      source_bar_at: sourceBarAt,
      source_name: stock?.dataSource ?? null,
      feature_version: "research-scan-v1",
      ai_power: typeof aiPower === "number" && Number.isFinite(aiPower) ? aiPower : null,
      entry_price: typeof entryPrice === "number" && Number.isFinite(entryPrice) ? entryPrice : null,
      rsi_band: stock?.patternLearning?.rsiBand ?? null,
      trend_key: stock?.patternLearning?.trendKey ?? null,
      ema20_key: stock?.patternLearning?.ema20Key ?? null,
      vwap_key: stock?.patternLearning?.vwapKey ?? null,
      macd_key: stock?.patternLearning?.macdKey ?? null,
      pattern_key: stock?.patternLearning?.patternKey ?? stock?.patternKey ?? null,
      capture_status: !duplicate && result.eligible ? "ASOF_CANDIDATE" : "QUARANTINED",
      audit_reason: duplicate ? "DUPLICATE_CODE" : result.reason,
    });
  }
  return rows;
}
