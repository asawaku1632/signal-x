const JST_TIME_ZONE = "Asia/Tokyo";
const SAFE_MARKET_DATA_HOUR = 15;
const SAFE_MARKET_DATA_MINUTE = 40;
const DEFAULT_MAX_LOOKBACK_DAYS = 14;

export const TSE_MARKET_CALENDAR_VERSION = "JPX_MARKET_HOLIDAYS_2026_2027_2026-02-06";
export const TSE_MARKET_CALENDAR_COVERAGE = Object.freeze({
  startDate: "2026-01-01",
  endDate: "2027-12-31",
});

// Source: Japan Exchange Group, "Market Holidays", updated 2026-02-06.
// https://www.jpx.co.jp/english/corporate/about-jpx/calendar/index.html
// JPX states that its markets close on Saturdays, Sundays, national holidays,
// and the additional market holidays listed on that page. Coverage is explicit;
// dates outside it are never inferred to be trading days.
const TSE_CLOSED_DATES = new Set([
  "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-12",
  "2026-02-11", "2026-02-23", "2026-03-20", "2026-04-29",
  "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06",
  "2026-07-20", "2026-08-11", "2026-09-21", "2026-09-22",
  "2026-09-23", "2026-10-12", "2026-11-03", "2026-11-23",
  "2026-12-31",
  "2027-01-01", "2027-01-02", "2027-01-03", "2027-01-11",
  "2027-02-11", "2027-02-23", "2027-03-21", "2027-03-22",
  "2027-04-29", "2027-05-03", "2027-05-04", "2027-05-05",
  "2027-07-19", "2027-08-11", "2027-09-20", "2027-09-23",
  "2027-10-11", "2027-11-03", "2027-11-23", "2027-12-31",
]);

export type TseMarketCalendar = {
  version: string;
  startDate: string;
  endDate: string;
  closedDates: ReadonlySet<string>;
};

export type TargetTradeDateReason =
  | "CURRENT_TSE_TRADING_DAY_AFTER_SAFE_BOUNDARY"
  | "PREVIOUS_TSE_TRADING_DAY_BEFORE_SAFE_BOUNDARY"
  | "PREVIOUS_TSE_TRADING_DAY_MARKET_CLOSED";

export type TargetTradeDateResolution = {
  runNowJst: string;
  targetTradeDate: string;
  targetTradeDateReason: TargetTradeDateReason;
  marketCalendarVersion: string;
};

export class TseMarketCalendarError extends Error {
  readonly code: "MARKET_CALENDAR_UNAVAILABLE" | "TARGET_TRADE_DATE_UNRESOLVED";
  constructor(code: TseMarketCalendarError["code"]) {
    super(code);
    this.name = "TseMarketCalendarError";
    this.code = code;
  }
}

export const TSE_MARKET_CALENDAR: TseMarketCalendar = Object.freeze({
  version: TSE_MARKET_CALENDAR_VERSION,
  ...TSE_MARKET_CALENDAR_COVERAGE,
  closedDates: TSE_CLOSED_DATES,
});

function dateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JST_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")), minute: Number(value("minute")), second: Number(value("second")) };
}

function shiftDate(date: string, days: number) {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) throw new TseMarketCalendarError("TARGET_TRADE_DATE_UNRESOLVED");
  return new Date(timestamp + days * 86_400_000).toISOString().slice(0, 10);
}

export function resolveTseTradingDatesAfter(date: string, count: number, options: {
  calendar?: TseMarketCalendar | null;
  maxLookaheadDays?: number;
} = {}) {
  const calendar = options.calendar === undefined ? TSE_MARKET_CALENDAR : options.calendar;
  if (!calendar) throw new TseMarketCalendarError("MARKET_CALENDAR_UNAVAILABLE");
  if (!Number.isInteger(count) || count < 1) {
    throw new TseMarketCalendarError("TARGET_TRADE_DATE_UNRESOLVED");
  }
  const maxLookaheadDays = options.maxLookaheadDays ?? DEFAULT_MAX_LOOKBACK_DAYS;
  if (!Number.isInteger(maxLookaheadDays) || maxLookaheadDays < count) {
    throw new TseMarketCalendarError("TARGET_TRADE_DATE_UNRESOLVED");
  }
  assertCovered(date, calendar);
  if (!isTseTradingDate(date, calendar)) {
    throw new TseMarketCalendarError("TARGET_TRADE_DATE_UNRESOLVED");
  }
  const resolved: string[] = [];
  for (let offset = 1; offset <= maxLookaheadDays && resolved.length < count; offset += 1) {
    const candidate = shiftDate(date, offset);
    if (isTseTradingDate(candidate, calendar)) resolved.push(candidate);
  }
  if (resolved.length !== count) {
    throw new TseMarketCalendarError("TARGET_TRADE_DATE_UNRESOLVED");
  }
  return resolved;
}

export function isTseTargetDateReady(targetDate: string, now = new Date(),
  calendar: TseMarketCalendar = TSE_MARKET_CALENDAR) {
  if (!Number.isFinite(now.getTime())) throw new TseMarketCalendarError("TARGET_TRADE_DATE_UNRESOLVED");
  if (!isTseTradingDate(targetDate, calendar)) {
    throw new TseMarketCalendarError("TARGET_TRADE_DATE_UNRESOLVED");
  }
  const readyAt = Date.parse(`${targetDate}T${String(SAFE_MARKET_DATA_HOUR).padStart(2, "0")}:${String(SAFE_MARKET_DATA_MINUTE).padStart(2, "0")}:00+09:00`);
  if (!Number.isFinite(readyAt)) throw new TseMarketCalendarError("TARGET_TRADE_DATE_UNRESOLVED");
  return now.getTime() >= readyAt;
}

function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function assertCovered(date: string, calendar: TseMarketCalendar) {
  if (date < calendar.startDate || date > calendar.endDate) {
    throw new TseMarketCalendarError("MARKET_CALENDAR_UNAVAILABLE");
  }
}

export function isTseTradingDate(date: string, calendar: TseMarketCalendar = TSE_MARKET_CALENDAR) {
  if (!calendar?.version || !calendar.closedDates) {
    throw new TseMarketCalendarError("MARKET_CALENDAR_UNAVAILABLE");
  }
  assertCovered(date, calendar);
  const day = weekday(date);
  return day !== 0 && day !== 6 && !calendar.closedDates.has(date);
}

export function resolveTargetTradeDate(now = new Date(), options: {
  calendar?: TseMarketCalendar | null;
  maxLookbackDays?: number;
} = {}): TargetTradeDateResolution {
  if (!Number.isFinite(now.getTime())) throw new TseMarketCalendarError("TARGET_TRADE_DATE_UNRESOLVED");
  const calendar = options.calendar === undefined ? TSE_MARKET_CALENDAR : options.calendar;
  if (!calendar) throw new TseMarketCalendarError("MARKET_CALENDAR_UNAVAILABLE");
  const maxLookbackDays = options.maxLookbackDays ?? DEFAULT_MAX_LOOKBACK_DAYS;
  if (!Number.isInteger(maxLookbackDays) || maxLookbackDays < 1) {
    throw new TseMarketCalendarError("TARGET_TRADE_DATE_UNRESOLVED");
  }
  const current = dateParts(now);
  const runNowJst = `${current.date}T${String(current.hour).padStart(2, "0")}:${String(current.minute).padStart(2, "0")}:${String(current.second).padStart(2, "0")}+09:00`;
  const todayIsTrading = isTseTradingDate(current.date, calendar);
  const afterSafeBoundary = current.hour * 60 + current.minute >= SAFE_MARKET_DATA_HOUR * 60 + SAFE_MARKET_DATA_MINUTE;
  if (todayIsTrading && afterSafeBoundary) {
    return { runNowJst, targetTradeDate: current.date,
      targetTradeDateReason: "CURRENT_TSE_TRADING_DAY_AFTER_SAFE_BOUNDARY",
      marketCalendarVersion: calendar.version };
  }
  const reason: TargetTradeDateReason = todayIsTrading
    ? "PREVIOUS_TSE_TRADING_DAY_BEFORE_SAFE_BOUNDARY"
    : "PREVIOUS_TSE_TRADING_DAY_MARKET_CLOSED";
  for (let offset = 1; offset <= maxLookbackDays; offset += 1) {
    const candidate = shiftDate(current.date, -offset);
    if (isTseTradingDate(candidate, calendar)) {
      return { runNowJst, targetTradeDate: candidate, targetTradeDateReason: reason,
        marketCalendarVersion: calendar.version };
    }
  }
  throw new TseMarketCalendarError("TARGET_TRADE_DATE_UNRESOLVED");
}
