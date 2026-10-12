import { createHash } from "node:crypto";
import {
  isTseTradingDate,
  TSE_MARKET_CALENDAR_VERSION,
} from "../technicalObservation/tseMarketCalendar.ts";

export const SHADOW_CANDLE_AUTO_MAX_STOCKS = 5;
export const SHADOW_CANDLE_AUTO_UTC_SCHEDULE = "35 23 * * 0-4"; // 08:35 JST Mon-Fri
export const SHADOW_CANDLE_AUTO_POLICY_VERSION = "FIVE_NEW_STOCKS_V1";

export type AutoDecision =
  | { ok: false; dateJst: string; reason: "CALENDAR_UNKNOWN" | "MARKET_CLOSED" | "OUTSIDE_MORNING_WINDOW" | "NO_ELIGIBLE_STOCKS"; calendar: string }
  | { ok: true; dateJst: string; codes: string[]; calendar: string };

function jstNow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minute: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

/** Calendar and time verification MUST precede any Yahoo requests or DB writes.
 * No calendar coverage => never guess a valid trading date.
 * At 08:35 Japan time only completed bars from previous sessions are present.
 */
export function selectShadowAutoDailyStocks(args: {
  now: Date;
  universe: readonly string[];
  coveredCodes: ReadonlySet<string>;
}): AutoDecision {
  const { date, minute } = jstNow(args.now);
  let tradingDay = false;
  try { tradingDay = isTseTradingDate(date); }
  catch { return { ok: false, dateJst: date, reason: "CALENDAR_UNKNOWN", calendar: TSE_MARKET_CALENDAR_VERSION }; }
  if (!tradingDay) {
    return { ok: false, dateJst: date, reason: "MARKET_CLOSED", calendar: TSE_MARKET_CALENDAR_VERSION };
  }
  if (minute < 8 * 60 + 30 || minute >= 9 * 60) {
    return { ok: false, dateJst: date, reason: "OUTSIDE_MORNING_WINDOW", calendar: TSE_MARKET_CALENDAR_VERSION };
  }
  const eligible = [...new Set(args.universe)]
    .filter(code => /^[0-9A-Z]{4,5}$/.test(code) && !args.coveredCodes.has(code))
    // Stable shuffle avoids systematically taking only the first sector in stockList.
    // This is still a convenience cohort, NOT a statistical random sample.
    .map(code => ({
      code, rank: createHash("sha256").update(`${SHADOW_CANDLE_AUTO_POLICY_VERSION}:${code}`).digest("hex"),
    }))
    .sort((a, b) => a.rank.localeCompare(b.rank) || a.code.localeCompare(b.code))
    .slice(0, SHADOW_CANDLE_AUTO_MAX_STOCKS)
    .map(x => x.code);
  return eligible.length
    ? { ok: true, dateJst: date, codes: eligible, calendar: TSE_MARKET_CALENDAR_VERSION }
    : { ok: false, dateJst: date, reason: "NO_ELIGIBLE_STOCKS", calendar: TSE_MARKET_CALENDAR_VERSION };
}
