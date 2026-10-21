/** Independent market-index research snapshot contract.
 * Not connected to scoring, notifications, orders, or production Cron.
 * Only accept an observation with an explicit source timestamp.
 */
export type MarketIndexKey = "nikkei" | "topix";
export type MarketIndexObservation = {
  index: MarketIndexKey;
  value: number;
  observedAt: string;
  source: string;
  capturedAt: string;
  sessionDateJst: string;
  status: "observed";
};

export type MarketIndexRejected = {
  index: MarketIndexKey;
  status: "missing" | "invalid" | "stale" | "future_timestamp";
  reason: string;
};

function jstDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function validateMarketIndexSnapshot(input: {
  index: MarketIndexKey;
  value: unknown;
  observedAt: unknown;
  source: unknown;
  capturedAt: string;
  maxAgeMinutes?: number;
}): MarketIndexObservation | MarketIndexRejected {
  const { index, value, observedAt, source, capturedAt } = input;
  if (value === null || value === undefined || observedAt === null || observedAt === undefined)
    return { index, status: "missing", reason: "Price or observation timestamp absent" };
  const capture = new Date(capturedAt);
  const observed = typeof observedAt === "string" ? new Date(observedAt) : new Date(NaN);
  if (!Number.isFinite(capture.getTime()) || !Number.isFinite(observed.getTime()) ||
      typeof value !== "number" || !Number.isFinite(value) || value <= 0 ||
      typeof source !== "string" || !source.trim())
    return { index, status: "invalid", reason: "Invalid price, timestamp or source" };
  const ageMs = capture.getTime() - observed.getTime();
  if (ageMs < -60_000)
    return { index, status: "future_timestamp", reason: "Observation occurs after capture" };
  const maxAgeMinutes = input.maxAgeMinutes ?? 20;
  if (ageMs > maxAgeMinutes * 60_000 || jstDate(capture) !== jstDate(observed))
    return { index, status: "stale", reason: "Observation too old or from another JST date" };
  return {
    index, value, observedAt: observed.toISOString(), source: source.trim(),
    capturedAt: capture.toISOString(), sessionDateJst: jstDate(observed), status: "observed",
  };
}
