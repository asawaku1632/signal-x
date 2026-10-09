import { resolveTseTradingDatesAfter } from "../technicalObservation/tseMarketCalendar.ts";

export const DAILY_CHECK_MIN_SNAPSHOT_ROWS = 750;
export const DAILY_CHECK_MIN_FUTURE_COVERAGE = 0.8;

export type DailyCheckDatePair = {
  targetDate: string;
  priceDate: string;
  targetCount: number;
  futurePriceCount: number;
};

// Never substitute the next *available* snapshot for the actual next trading
// session. Small/incomplete source days also must not create a fake outcome.
export function isSafeDailyCheckPair({
  targetDate,
  priceDate,
  targetCount,
  futurePriceCount,
}: DailyCheckDatePair): boolean {
  if (!Number.isInteger(targetCount) ||
      targetCount < DAILY_CHECK_MIN_SNAPSHOT_ROWS ||
      !Number.isInteger(futurePriceCount) ||
      futurePriceCount < Math.ceil(targetCount * DAILY_CHECK_MIN_FUTURE_COVERAGE)) {
    return false;
  }
  try {
    return resolveTseTradingDatesAfter(targetDate, 1, { maxLookaheadDays: 14 })[0] === priceDate;
  } catch {
    return false;
  }
}
