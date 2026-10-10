import { isTseTradingDate, resolveTseTradingDatesAfter } from "../technicalObservation/tseMarketCalendar.ts";

export const CONFLICT_HORIZONS = [3, 5, 10] as const;
export const CONFLICT_LOOKBACK_SESSIONS = 5;

// A precursor must be on or before the EXIT date and no more than five
// JPX trading sessions old. Calendar days, missing saved prices, and
// future observations cannot be used to extend the window.
export function isRecentPrecursorAtExit(
  precursorDate: string | null,
  exitDate: string,
): boolean {
  if (!precursorDate || precursorDate > exitDate) return false;
  try {
    if (!isTseTradingDate(precursorDate) || !isTseTradingDate(exitDate)) return false;
    if (precursorDate === exitDate) return true;
    const sessions = resolveTseTradingDatesAfter(
      precursorDate, CONFLICT_LOOKBACK_SESSIONS, { maxLookaheadDays: 45 },
    );
    return sessions.includes(exitDate);
  } catch {
    return false; // Outside the known market calendar: do not infer.
  }
}
