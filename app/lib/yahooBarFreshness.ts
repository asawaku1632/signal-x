export const DAILY_FALLBACK_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isYahooDailyBarFresh(
  latestBarTimestamp: number,
  now = Date.now(),
) {
  if (!Number.isFinite(latestBarTimestamp)) return false;
  return now - latestBarTimestamp * 1000 <= DAILY_FALLBACK_MAX_AGE_MS;
}

export class StaleYahooBarError extends Error {
  constructor(code: string, latestBarTimestamp: number) {
    super(`Stale Yahoo daily fallback for ${code}: ${latestBarTimestamp}`);
    this.name = "StaleYahooBarError";
  }
}
