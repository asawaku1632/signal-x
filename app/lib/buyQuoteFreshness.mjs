// Freshness of the actual Yahoo candle, not the scan snapshot save time.
export const MAX_BUY_QUOTE_AGE_MS = 15 * 60_000;

export function buyQuoteFreshness(stock, scan, nowMs = Date.now()) {
  const snapshotTime = Date.parse(String(scan?.updatedAt ?? ""));
  if (scan?.status !== "fresh" || !Number.isFinite(snapshotTime) ||
      nowMs < snapshotTime || nowMs - snapshotTime > MAX_BUY_QUOTE_AGE_MS) {
    return { ok: false, reason: "scan_stale" };
  }
  // Daily fallback is not a live intraday buy quote even if saved recently.
  if (stock?.dataSource !== "intraday") {
    return { ok: false, reason: "quote_not_intraday" };
  }
  const timestamp = stock?.latestBarTimestamp;
  const seconds = typeof timestamp === "number" || typeof timestamp === "string"
    ? Number(timestamp) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return { ok: false, reason: "quote_time_unknown" };
  }
  const ageMs = nowMs - seconds * 1000;
  if (ageMs < 0 || ageMs > MAX_BUY_QUOTE_AGE_MS) {
    return { ok: false, reason: "quote_stale_or_future" };
  }
  return { ok: true, reason: "fresh" };
}
