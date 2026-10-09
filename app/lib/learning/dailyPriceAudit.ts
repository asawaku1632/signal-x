/**
 * Read-only verification of daily learning prices against a later Yahoo 1D bar.
 * NEVER writes to learning results or changes the trading / notification models.
 */
export type PriceCheckStatus = "MATCH" | "MISMATCH";
export type DailyReference = { date: string; close: number; barTime: number };

export function isValidJapanStockCode(code: string): boolean {
  return /^[0-9]{4}$/.test(code);
}
export function isValidPriceAuditDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function jstDateFromUnix(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(seconds * 1000));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}
export function collectYahooDailyReferences(chartResult: unknown): DailyReference[] {
  if (!chartResult || typeof chartResult !== "object") return [];
  const chart = chartResult as {
    timestamp?: unknown;
    indicators?: { quote?: Array<{ close?: unknown }> };
  };
  const timestamps = chart.timestamp;
  const closes = chart.indicators?.quote?.[0]?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return [];
  return timestamps.flatMap((value: unknown, i: number) => {
    const time = Number(value);
    const raw = closes[i];
    const close = raw == null ? NaN : Number(raw);
    const date = jstDateFromUnix(time);
    return date && Number.isFinite(close) && close > 0 ? [{ date, close, barTime: time }] : [];
  });
}
export function compareDailyLearningPrice(saved: number, reference: DailyReference) {
  if (!Number.isFinite(saved) || saved <= 0 || !Number.isFinite(reference.close) || reference.close <= 0) {
    throw new Error("INVALID_PRICE");
  }
  const differenceYen = Number((saved - reference.close).toFixed(4));
  const differencePercent = Number((100 * differenceYen / reference.close).toFixed(4));
  const status: PriceCheckStatus = Math.abs(differenceYen) <= 0.01 ? "MATCH" : "MISMATCH";
  return { status, differenceYen, differencePercent };
}
