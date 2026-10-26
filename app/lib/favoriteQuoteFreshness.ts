/** Safety guard for timestamped market bars; Unix seconds are required. */
export const MAX_FAVORITE_QUOTE_AGE_SECONDS = 300;

export function favoriteQuoteFreshness(quoteUnixSeconds: unknown, now = new Date()) {
  if ((typeof quoteUnixSeconds !== "number" && typeof quoteUnixSeconds !== "string")
      || (typeof quoteUnixSeconds === "string" && !quoteUnixSeconds.trim())) {
    return { ok: false, reason: "quote_timestamp_missing" as const, ageSeconds: null };
  }
  const seconds = Number(quoteUnixSeconds);
  const ageSeconds = now.getTime() / 1000 - seconds;
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(ageSeconds)) {
    return { ok: false, reason: "quote_timestamp_invalid" as const, ageSeconds: null };
  }
  if (ageSeconds < 0) {
    return { ok: false, reason: "quote_timestamp_future" as const, ageSeconds };
  }
  if (ageSeconds > MAX_FAVORITE_QUOTE_AGE_SECONDS) {
    return { ok: false, reason: "quote_too_old" as const, ageSeconds };
  }
  return { ok: true, reason: "fresh" as const, ageSeconds };
}
