import type { MarketIndexKey } from "./marketIndexShadowContract";

export type BenchmarkWindow = "intraday_0905" | "daily_close";
export type BenchmarkEvidence = {
  index: MarketIndexKey;
  value: unknown;
  source: unknown;
  observedAt: unknown;
  capturedAt: string;
  sessionDateJst?: unknown;
};

function jstDay(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(value);
}

/** Research-only, never a trading recommendation. Rejects date-only daily bars in intraday mode. */
export function assessBenchmarkWindow(window: BenchmarkWindow, evidence: BenchmarkEvidence) {
  const { index, value, source, observedAt, capturedAt } = evidence;
  const capture = new Date(capturedAt);
  const observation = typeof observedAt === "string" ? new Date(observedAt) : new Date(NaN);
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 ||
      typeof source !== "string" || !source.trim() ||
      !Number.isFinite(capture.getTime()))
    return { index, window, status: "invalid" as const, reason: "Invalid value, source or capture time" };
  if (window === "daily_close") {
    // Daily bars are date-based. Never infer an exact market timestamp.
    const day = evidence.sessionDateJst;
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day))
      return { index, window, status: "missing" as const, reason: "Explicit session date required" };
    if (day > jstDay(capture))
      return { index, window, status: "future_timestamp" as const, reason: "Future session date" };
    return { index, window, status: "daily_observed" as const, sessionDateJst: day, value, source: source.trim() };
  }
  if (!Number.isFinite(observation.getTime()))
    return { index, window, status: "missing" as const, reason: "Intraday source timestamp required" };
  const lag = capture.getTime() - observation.getTime();
  if (lag < -60_000)
    return { index, window, status: "future_timestamp" as const, reason: "Observation after capture" };
  if (lag > 20 * 60_000 || jstDay(capture) !== jstDay(observation))
    return { index, window, status: "stale" as const, reason: "Intraday observation too old" };
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(observation);
  if (parts < "09:00" || parts > "09:05")
    return { index, window, status: "outside_window" as const, reason: "Not a 09:00-09:05 observation" };
  return { index, window, status: "intraday_observed" as const, observedAt: observation.toISOString(), value, source: source.trim() };
}
