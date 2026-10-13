/**
 * Night-before limit-order reference.
 *
 * Research-only UI helper. Uses only completed Yahoo daily candles and the
 * historical distribution of positive overnight opening gaps. It does not
 * predict tomorrow's open, guarantee execution, or place orders.
 */
export type DailyCandle = {
  time: number; // Yahoo epoch seconds (daily bar)
  open: number;
  close: number;
};

export type OvernightBuyLimit =
  | { status: "market_open" | "insufficient_data" | "stale" }
  | {
      status: "ready";
      referenceDate: string;
      referenceClose: number;
      limitYen: number;
      additionalYen: number;
      premiumPercent: number;
      gapSamples: number;
      positiveGapSamples: number;
    };

const TOKYO = "Asia/Tokyo";
const MAX_REFERENCE_AGE_DAYS = 9;
const MIN_VALID_GAPS = 30;
const MIN_POSITIVE_GAPS = 8;
const MAX_PREMIUM_PERCENT = 2;

/** Explicit numeric parts avoid depending on device locale or timezone. */
function tokyoTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TOKYO,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (key: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === key)?.value ?? "";
  return {
    date: get("year") + "-" + get("month") + "-" + get("day"),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    weekday: get("weekday"),
  };
}

function ageInCalendarDays(earlier: string, later: string) {
  const a = Date.parse(earlier + "T00:00:00Z");
  const b = Date.parse(later + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

export function estimateOvernightBuyLimit(
  candles: DailyCandle[],
  now = new Date(),
  options: { forMorningRecheck?: boolean } = {},
): OvernightBuyLimit {
  const clock = tokyoTime(now);
  const weekday = clock.weekday !== "Sat" && clock.weekday !== "Sun";
  // The previous close is not the basis for a new overnight reference while
  // the Japanese cash market is open. Wait until after the 15:30 close.
  if (!options.forMorningRecheck && weekday && clock.minutes >= 9 * 60 && clock.minutes < 15 * 60 + 45) {
    return { status: "market_open" };
  }

  if (!Array.isArray(candles)) return { status: "insufficient_data" };
  const byDay = new Map<string, DailyCandle>();
  for (const raw of candles) {
    if (
      !raw ||
      !Number.isFinite(raw.time) ||
      raw.time <= 0 ||
      raw.time > 3_000_000_000 ||
      !Number.isFinite(raw.open) ||
      !Number.isFinite(raw.close) ||
      raw.open <= 0 ||
      raw.close <= 0
    ) continue;
    const day = tokyoTime(new Date(raw.time * 1000)).date;
    // Never use a same-day bar before the market has fully closed.
    if (day > clock.date || (day === clock.date && clock.minutes < 15 * 60 + 45)) continue;
    byDay.set(day, raw);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const latest = days.at(-1);
  if (!latest) return { status: "insufficient_data" };
  const age = ageInCalendarDays(latest[0], clock.date);
  if (age < 0 || age > MAX_REFERENCE_AGE_DAYS) return { status: "stale" };

  const recent = days.slice(-81).map(([, candle]) => candle);
  const upwardGaps: number[] = [];
  let gapSamples = 0;
  for (let i = 1; i < recent.length; i++) {
    const priorClose = recent[i - 1].close;
    const openingGap = (recent[i].open - priorClose) / priorClose;
    // Extreme gaps can be splits, data errors, or exceptional events.
    if (!Number.isFinite(openingGap) || Math.abs(openingGap) > 0.15) continue;
    gapSamples++;
    if (openingGap > 0) upwardGaps.push(openingGap);
  }
  if (gapSamples < MIN_VALID_GAPS || upwardGaps.length < MIN_POSITIVE_GAPS) {
    return { status: "insufficient_data" };
  }

  upwardGaps.sort((a, b) => a - b);
  // 75th percentile among positive opening gaps: a descriptive historical
  // statistic, NOT a calibrated probability of execution.
  const index = Math.max(0, Math.ceil(upwardGaps.length * 0.75) - 1);
  const premium = Math.min(upwardGaps[index], MAX_PREMIUM_PERCENT / 100);
  const referenceClose = latest[1].close;
  // Floor prevents exceeding the statistical cap; securities tick sizes may
  // require the user to adjust the order price downward at their broker.
  const limitYen = Math.floor(referenceClose * (1 + premium));
  if (limitYen <= 0) return { status: "insufficient_data" };
  return {
    status: "ready",
    referenceDate: latest[0],
    referenceClose,
    limitYen,
    additionalYen: Math.max(0, limitYen - referenceClose),
    premiumPercent: Math.round(((limitYen / referenceClose) - 1) * 10_000) / 100,
    gapSamples,
    positiveGapSamples: upwardGaps.length,
  };
}
