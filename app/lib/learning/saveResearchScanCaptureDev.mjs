import { prepareScanFeatureCaptures } from "./prepareScanFeatureCaptures.mjs";

// Explicitly injected development-only pg client. NEVER call from production routes.
// No UPDATE or DELETE. All writes are append-once and isolated by run ID.
export async function saveResearchScanCaptureDev(client, input) {
  if (process.env.NODE_ENV === "production" || process.env.SIGNALX_RESEARCH_DEV_WRITE !== "true") {
    throw new Error("RESEARCH_DEV_WRITE_DISABLED");
  }
  // Guard the low-level writer too: direct callers must not bypass the
  // research-use permission check applied by higher-level dev entry points.
  if (process.env.NODE_ENV === "development" &&
      process.env.SIGNALX_RESEARCH_PROVIDER_PERMISSION_CONFIRMED !== "true")
    throw new Error("RESEARCH_PROVIDER_PERMISSION_NOT_CONFIRMED");
  if (!client || typeof client.query !== "function") throw new Error("INVALID_DB_CLIENT");
  // Fail closed: an injected client must expose the exact development DB host.
  // A generic PostgreSQL pooler cannot establish project identity here.
  const host = client.connectionParameters?.host;
  const isolatedCi = process.env.NODE_ENV === "test"
    && process.env.SIGNALX_RESEARCH_ISOLATED_PG === "true"
    && (host === "127.0.0.1" || host === "localhost")
    && client.connectionParameters?.database === "signalx_research_ci"
    && client.connectionParameters?.user === "signalx_ci";
  if (host !== "db.jdtqwryiyxeuoraecorw.supabase.co" && !isolatedCi) {
    throw new Error("RESEARCH_DEV_DATABASE_NOT_VERIFIED");
  }
  // Reject invalid run metadata before any INSERT. Do not silently lose rows.
  const received = typeof input?.scanReceivedAt === "string" ? Date.parse(input.scanReceivedAt) : NaN;
  const tradeDate = input?.tradeDate;
  const validDate = typeof tradeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(tradeDate)
    && !Number.isNaN(Date.parse(tradeDate + "T00:00:00Z"))
    && new Date(tradeDate + "T00:00:00Z").toISOString().slice(0, 10) === tradeDate;
  // Trade date must agree with the Scan receipt date in Japan, never with UTC's date.
  const receivedDateJst = Number.isFinite(received)
    ? (() => {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
        }).formatToParts(new Date(received));
        const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
        return `${values.year}-${values.month}-${values.day}`;
      })()
    : null;
  const validRunId = typeof input?.scanRunId === "string" && input.scanRunId.trim().length > 0;
  const validScan = Array.isArray(input?.scanResponse?.stocks) && input.scanResponse.stocks.length > 0;
  if (!Number.isFinite(received) || !validDate || tradeDate !== receivedDateJst || !validRunId || !validScan) {
    throw new Error("INVALID_RESEARCH_RUN_METADATA");
  }
  const rows = prepareScanFeatureCaptures(input);
  // The development schema permits only quarantined or candidate rows.
  if (rows.some(row => row.capture_status !== 'QUARANTINED')) throw new Error('UNSAFE_RESEARCH_CAPTURE_STATUS');
  const summary = { attempted: rows.length, inserted: 0, duplicates: 0, quarantined: 0 };
  const seen = new Set();
  for (const row of rows) {
    // Never send repeated identities to SQL; avoid ambiguous first-write semantics.
    const identity = JSON.stringify([row.scan_run_id, row.code]);
    if (seen.has(identity)) {
      summary.duplicates++;
      summary.quarantined++;
      continue;
    }
    seen.add(identity);
    // Invalid identifiers cannot be safely inserted under the unique key.
    if (!/^(?:[0-9]{4,5}|[0-9]{3}[A-Z])$/.test(row.code) || !row.scan_run_id || !Number.isFinite(Date.parse(row.scan_received_at)) || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(row.trade_date)) {
      summary.quarantined++;
      continue;
    }
    const result = await client.query(
      `INSERT INTO public.research_scan_feature_captures
      (scan_run_id,trade_date,code,scan_received_at,source_bar_at,source_name,feature_version,ai_power,entry_price,
       rsi_band,trend_key,ema20_key,vwap_key,macd_key,pattern_key,capture_status,audit_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (scan_run_id,code) DO NOTHING RETURNING capture_id`,
      [row.scan_run_id,row.trade_date,row.code,row.scan_received_at,row.source_bar_at,row.source_name,row.feature_version,
       row.ai_power,row.entry_price,row.rsi_band,row.trend_key,row.ema20_key,row.vwap_key,row.macd_key,row.pattern_key,row.capture_status,row.audit_reason],
    );
    if (result.rowCount === 1) summary.inserted++;
    else summary.duplicates++;
    if (row.capture_status === "QUARANTINED") summary.quarantined++;
  }
  return summary;
}
