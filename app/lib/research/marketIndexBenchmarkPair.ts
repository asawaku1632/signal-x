import type { MarketIndexKey } from "./marketIndexShadowContract";
import type { BenchmarkWindow } from "./marketIndexBenchmarkWindow";

export type BenchmarkPoint = {
  index: MarketIndexKey;
  window: BenchmarkWindow;
  sessionDateJst: string;
  value: number;
  observedAt?: string;
  source: string;
};

/** Pure, research-only pair comparison. No trading advice, notifications, or DB writes. */
export function compareBenchmarkPoints(before: BenchmarkPoint, after: BenchmarkPoint) {
  if (before.index !== after.index || before.window !== after.window)
    return { status: "incompatible" as const, reason: "Index or window differs" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(before.sessionDateJst) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(after.sessionDateJst) ||
      after.sessionDateJst < before.sessionDateJst)
    return { status: "invalid_date" as const, reason: "Session dates invalid or reversed" };
  if (!Number.isFinite(before.value) || !Number.isFinite(after.value) ||
      before.value <= 0 || after.value <= 0 ||
      !before.source.trim() || !after.source.trim())
    return { status: "invalid" as const, reason: "Invalid price or source" };
  if (before.window === "intraday_0905") {
    const a = before.observedAt ? Date.parse(before.observedAt) : NaN;
    const b = after.observedAt ? Date.parse(after.observedAt) : NaN;
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a)
      return { status: "missing_timestamp" as const, reason: "Ordered timestamps required" };
  }
  if (before.sessionDateJst === after.sessionDateJst)
    return { status: "same_session" as const, reason: "No forward-session performance" };
  const changePct = (after.value / before.value - 1) * 100;
  return { status: "comparable" as const, index: before.index, window: before.window,
    fromDate: before.sessionDateJst, toDate: after.sessionDateJst, changePct };
}
