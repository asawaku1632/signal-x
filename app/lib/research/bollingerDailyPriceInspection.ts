/** Pure research-only daily price inspection. No persistence or trading logic. */
export type DailyBar = { date: string; close: number };
export type DailyInspection = {
  code: string; observations: number; firstDate: string | null;
  lastDate: string | null; duplicateDates: number;
  missingClose: number; invalidClose: number;
  nonAscendingDates: number; latestDateIsTodayOrEarlier: boolean;
  sampleLastFive: DailyBar[];
};
export function inspectDailyPriceChart(code: string, chart: unknown, todayJst: string): DailyInspection {
  if (!/^\d{4}$/.test(code) || !/^\d{4}-\d{2}-\d{2}$/.test(todayJst)) {
    throw Error("INVALID_INSPECTION_ARGUMENTS");
  }
  const data = chart as { timestamp?: unknown; indicators?: { quote?: Array<{ close?: unknown }> } } | null;
  const timestamps = data?.timestamp;
  const closes = data?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) {
    throw Error("INVALID_PRICE_CHART");
  }
  let duplicateDates = 0, missingClose = 0, invalidClose = 0, nonAscendingDates = 0;
  const seen = new Set<string>();
  const valid: DailyBar[] = [];
  let previousDate = "";
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    if (typeof ts !== "number" || !Number.isFinite(ts)) {
      invalidClose++; continue;
    }
    const date = new Date(ts * 1000).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
    if (seen.has(date)) duplicateDates++;
    seen.add(date);
    if (previousDate && date <= previousDate) nonAscendingDates++;
    previousDate = date;
    const close = closes[i];
    if (close === null || close === undefined) { missingClose++; continue; }
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) { invalidClose++; continue; }
    valid.push({ date, close });
  }
  return {
    code, observations: timestamps.length,
    firstDate: valid[0]?.date ?? null,
    lastDate: valid[valid.length - 1]?.date ?? null,
    duplicateDates, missingClose, invalidClose, nonAscendingDates,
    latestDateIsTodayOrEarlier: valid.length > 0 && valid[valid.length - 1].date <= todayJst,
    sampleLastFive: valid.slice(-5),
  };
}
