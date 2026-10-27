/**
 * Read-only input adapter for the offline forward evaluator.
 * This module deliberately has no database, provider, or network imports.
 * It never assumes an old Yahoo-derived scan price is on the same
 * corporate-action/closing-price basis as J-Quants OHLC.
 */
export function adaptDailySnapshotsForForwardResearch(rows) {
  if (!Array.isArray(rows)) throw new TypeError("rows must be an array");
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    code: String(row.code ?? "").trim(),
    date: typeof row.date === "string" ? row.date.slice(0, 10) : "",
    score: Number.isFinite(Number(row.score)) ? Number(row.score) : null,
    referencePrice: Number(row.price),
    // Cannot infer comparable price basis from legacy daily_stock_results.
    priceBasisVerified: false,
  }));
}

/**
 * Only externally verified corporate-action-compatible records may pass.
 * Unknown/missing verification stays false, even if a price is present.
 */
export function adaptLicensedDailyClosesForForwardResearch(rows) {
  if (!Array.isArray(rows)) throw new TypeError("rows must be an array");
  return rows.map((row) => ({
    code: String(row.code ?? "").trim(),
    date: typeof row.date === "string" ? row.date.slice(0, 10) : "",
    close: Number(row.close),
    priceBasisVerified: row.priceBasisVerified === true,
    corporateActionUnresolved: row.corporateActionUnresolved !== false,
  }));
}
