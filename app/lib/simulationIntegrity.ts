import { getTseCashSessionStatus } from "./technicalObservation/tseMarketCalendar";

export const PAPER_SIMULATION_MAX_SCAN_AGE_MS = 2 * 60 * 1000;

export type PaperMarketGate = {
  ok: boolean;
  reason:
    | "READY"
    | "MARKET_CLOSED"
    | "WAIT_FIRST_FIVE_MINUTES"
    | "CLOSING_AUCTION"
    | "SCAN_MISSING_OR_STALE";
};

/**
 * A cached closing quote is not an executable future-day buy/sell price.
 * This restricts simulated fills to market sessions with a recent scan.
 * 09:05 is the earliest permitted time; this is NOT a claim that the
 * observed quote is a true executable bid/ask or guaranteed fill.
 */
export function assessPaperMarketGate(
  now: Date,
  scanUpdatedAt: string | null | undefined,
): PaperMarketGate {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    return { ok: false, reason: "SCAN_MISSING_OR_STALE" };
  }
  let session: ReturnType<typeof getTseCashSessionStatus>;
  try {
    session = getTseCashSessionStatus(now);
  } catch {
    return { ok: false, reason: "MARKET_CLOSED" };
  }
  if (!session.open) return { ok: false, reason: "MARKET_CLOSED" };
  const minutes = session.hour * 60 + session.minute;
  if (minutes < 9 * 60 + 5) {
    return { ok: false, reason: "WAIT_FIRST_FIVE_MINUTES" };
  }
  if (minutes >= 15 * 60 + 25) {
    return { ok: false, reason: "CLOSING_AUCTION" };
  }

  const scanTime = scanUpdatedAt ? Date.parse(scanUpdatedAt) : NaN;
  const age = now.getTime() - scanTime;
  if (!Number.isFinite(scanTime) || age < 0 || age > PAPER_SIMULATION_MAX_SCAN_AGE_MS) {
    return { ok: false, reason: "SCAN_MISSING_OR_STALE" };
  }
  try {
    if (getTseCashSessionStatus(new Date(scanTime)).date !== session.date) {
      return { ok: false, reason: "SCAN_MISSING_OR_STALE" };
    }
  } catch {
    return { ok: false, reason: "SCAN_MISSING_OR_STALE" };
  }
  return { ok: true, reason: "READY" };
}

/**
 * Historical paper-trade quality flag. Old trades are never removed or
 * rewritten, but a weekend/holiday/pre-09:05 assumed fill cannot count
 * as verified achievable profit in comparative forecast research.
 */
export function isMarketSessionPaperEntry(startedAt: string | null | undefined) {
  if (!startedAt) return false;
  const when = new Date(startedAt);
  if (!Number.isFinite(when.getTime())) return false;
  try {
    const session = getTseCashSessionStatus(when);
    const minutes = session.hour * 60 + session.minute;
    return session.open && minutes >= 9 * 60 + 5 && minutes < 15 * 60 + 25;
  } catch {
    return false;
  }
}
