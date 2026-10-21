// Market-session-specific stale-reference guard. Yahoo bar timestamps are candle
// timestamps, not when the browser fetched them. This is a presentation-only guard.
/**
 * @param {number | null | undefined} timestamp Unix seconds of final price bar
 * @param {number | null | undefined} nowMs Browser time in milliseconds
 * @param {string} timeframe Chart resolution
 * @returns {number | null} Elapsed minutes only when a 5-minute bar is delayed
 * by at least 10 minutes during the Tokyo Stock Exchange's regular session.
 */
export function intradayBarDelayMinutes(timestamp, nowMs, timeframe) {
  if (timeframe !== "5m") return null;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp <= 0) return null;
  if (typeof nowMs !== "number" || !Number.isFinite(nowMs) || nowMs <= 0) return null;
  const ageMs = nowMs - timestamp * 1000;
  if (ageMs < 10 * 60_000) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(nowMs));
  const getPart = (type) => parts.find((part) => part.type === type)?.value ?? "";
  const day = getPart("weekday");
  if (day === "Sat" || day === "Sun") return null;
  const minutes = Number(getPart("hour")) * 60 + Number(getPart("minute"));
  // Exclude the lunch break and after-hours to avoid false delay warnings.
  const morning = minutes >= 9 * 60 && minutes < 11 * 60 + 30;
  const afternoon = minutes >= 12 * 60 + 30 && minutes < 15 * 60 + 30;
  if (!morning && !afternoon) return null;

  // Yesterday's bar is handled separately by the date guard.
  const todayJst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  });
  if (todayJst.format(new Date(timestamp * 1000)) !== todayJst.format(new Date(nowMs))) return null;
  return Math.floor(ageMs / 60_000);
}
