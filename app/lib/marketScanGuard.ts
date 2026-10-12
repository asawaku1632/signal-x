import {
  getTseCashSessionStatus,
  TSE_MARKET_CALENDAR_VERSION,
} from "@/app/lib/technicalObservation/tseMarketCalendar";

/**
 * A conservative market-date guard for scheduled/display-only *full scans*.
 *
 * Holiday/weekend: use the last saved snapshot, never re-request ~1,200
 * Yahoo charts simply because a 60-second TTL expired.
 * TSE trading day: retain the original refresh policy, including pre-open
 * and after-hours requests (do not delay the next trading day's scan).
 *
 * Outside the explicit JPX calendar horizon, retain previous behavior rather
 * than silently disabling normal scanning. Report unknown to callers.
 */
export type MarketScanGuard = {
  refreshAllowed: boolean;
  closed: boolean;
  calendarKnown: boolean;
  dateJst: string | null;
  calendarVersion: string;
};

export function marketScanGuard(now = new Date()): MarketScanGuard {
  try {
    const market = getTseCashSessionStatus(now);
    const closed = market.reason === "TSE_MARKET_CLOSED";
    return {
      refreshAllowed: !closed,
      closed,
      calendarKnown: true,
      dateJst: market.date,
      calendarVersion: TSE_MARKET_CALENDAR_VERSION,
    };
  } catch (error) {
    console.warn("market scan holiday guard: unavailable calendar, retaining prior scan behavior",
      error instanceof Error ? error.message : String(error));
    return {
      refreshAllowed: true,
      closed: false,
      calendarKnown: false,
      dateJst: null,
      calendarVersion: TSE_MARKET_CALENDAR_VERSION,
    };
  }
}

/**
 * Quote timestamps come from the underlying stock bars and can be older
 * than the moment a snapshot was saved. Do not call them today's prices.
 */
export function quoteDateJst(unixSeconds: unknown): string | null {
  if (typeof unixSeconds !== "number" && typeof unixSeconds !== "string") return null;
  if (typeof unixSeconds === "string" && !unixSeconds.trim()) return null;
  const value = Number(unixSeconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
