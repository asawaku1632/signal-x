import { analyzeNecklineTimeline } from "./necklineEarlyStudy.mjs";

/**
 * UI-only projection of the existing causal research algorithm.
 * The study reruns on completed daily bars, and NEVER implies historical
 * real-time capture, a guaranteed breakout, an order, or a notification.
 */
const jstDay = (date) => new Date(date).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

export function completedDailyBars(raw, now = new Date()) {
  if (!Array.isArray(raw) || Number.isNaN(now.getTime())) return null;
  const utcNow = now.getTime() / 1000;
  const today = jstDay(now);
  const hour = Number(now.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Tokyo", hour: "2-digit", hour12: false,
  }).slice(0, 2));
  const completed = [];
  let previous = -Infinity;
  for (const bar of raw) {
    if (!bar || [bar.time, bar.open, bar.high, bar.low, bar.close]
      .some(value => typeof value !== "number" || !Number.isFinite(value) || value <= 0)
      || bar.time <= previous || bar.time > utcNow
      || bar.high < Math.max(bar.open, bar.close, bar.low)
      || bar.low > Math.min(bar.open, bar.close, bar.high)
      || (bar.volume !== undefined && (typeof bar.volume !== "number" || !Number.isFinite(bar.volume) || bar.volume < 0))) return null;
    previous = bar.time;
    const day = jstDay(bar.time * 1000);
    if (day > today) return null;
    if (day < today || hour >= 16) completed.push(bar);
  }
  return completed;
}

export function observedNecklineOverlay(raw, now = new Date()) {
  const candles = completedDailyBars(raw, now);
  if (!candles || candles.length < 25) return { status: "INSUFFICIENT", overlay: null };
  const study = analyzeNecklineTimeline(candles);
  if (!study.dataValid) return { status: "INSUFFICIENT", overlay: null };
  const candidate = study.latest;
  if (!candidate || candidate.second < candles.length - 65) {
    return { status: "NONE", overlay: null };
  }
  const first = candles[candidate.first], second = candles[candidate.second];
  const firstSeen = candles[candidate.firstSeenIndex];
  if (!first || !second || !firstSeen
    || candidate.first >= candidate.second
    || candidate.firstSeenIndex < candidate.second + 2
    || !Number.isFinite(candidate.neckline) || candidate.neckline <= 0) {
    return { status: "INSUFFICIENT", overlay: null };
  }
  const breakout = candidate.breakoutIndex == null ? null : candles[candidate.breakoutIndex];
  const overlay = {
    firstTime: first.time,
    secondTime: second.time,
    low1: candidate.low1,
    low2: candidate.low2,
    neckline: candidate.neckline,
    firstSeenTime: firstSeen.time,
    breakoutTime: breakout?.time ?? null,
    state: candidate.status,
    lastCompletedTime: candles[candles.length - 1].time,
  };
  return { status: "FOUND", overlay };
}
