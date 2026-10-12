import { createHash } from "node:crypto";
import { isTseTradingDate, TSE_MARKET_CALENDAR_VERSION } from "../technicalObservation/tseMarketCalendar.ts";

export const HORIZONTAL_AUTO_MAX_STOCKS = 5;
export const HORIZONTAL_AUTO_UTC_SCHEDULE = "50 23 * * 0-4"; // 08:50 JST next day
export const HORIZONTAL_AUTO_POLICY_VERSION = "HORIZONTAL_NEW_FIVE_V1";
type Reason = "CALENDAR_UNKNOWN" | "MARKET_CLOSED" | "OUTSIDE_MORNING_WINDOW" | "NO_ELIGIBLE_STOCKS";
export type HorizontalAutoDecision =
  | { ok: false; dateJst: string; reason: Reason; calendar: string }
  | { ok: true; dateJst: string; codes: string[]; calendar: string };

function localTime(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const val = (name: string) => parts.find(p => p.type === name)?.value ?? "";
  return {
    dateJst: val("year") + "-" + val("month") + "-" + val("day"),
    minuteJst: Number(val("hour")) * 60 + Number(val("minute")),
  };
}

/** Only confirmed prior sessions; unknown JPX calendar must fail closed.
 * Stable hashed order avoids simply taking the first few tickers from stockList,
 * but selection is NOT a statistically random representative sample.
 */
export function selectHorizontalAutoDailyStocks(args: {
  now: Date;
  universe: readonly string[];
  coveredCodes: ReadonlySet<string>;
}): HorizontalAutoDecision {
  const { dateJst, minuteJst } = localTime(args.now);
  let isOpen: boolean;
  try { isOpen = isTseTradingDate(dateJst); }
  catch { return { ok: false, dateJst, reason: "CALENDAR_UNKNOWN", calendar: TSE_MARKET_CALENDAR_VERSION }; }
  if (!isOpen) {
    return { ok: false, dateJst, reason: "MARKET_CLOSED", calendar: TSE_MARKET_CALENDAR_VERSION };
  }
  // Allows several minutes of scheduler jitter, but no arbitrary daytime calls.
  if (minuteJst < 8 * 60 + 40 || minuteJst >= 9 * 60) {
    return { ok: false, dateJst, reason: "OUTSIDE_MORNING_WINDOW", calendar: TSE_MARKET_CALENDAR_VERSION };
  }
  const codes = [...new Set(args.universe)]
    .filter(code => /^[0-9]{4}$/.test(code) && !args.coveredCodes.has(code))
    .map(code => ({ code,
      rank: createHash("sha256").update(HORIZONTAL_AUTO_POLICY_VERSION + ":" + code).digest("hex") }))
    .sort((a,b) => a.rank.localeCompare(b.rank) || a.code.localeCompare(b.code))
    .slice(0, HORIZONTAL_AUTO_MAX_STOCKS).map(row => row.code);
  return codes.length
    ? { ok: true, dateJst, codes, calendar: TSE_MARKET_CALENDAR_VERSION }
    : { ok: false, dateJst, reason: "NO_ELIGIBLE_STOCKS", calendar: TSE_MARKET_CALENDAR_VERSION };
}
