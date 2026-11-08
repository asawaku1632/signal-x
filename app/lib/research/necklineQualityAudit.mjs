import { analyzeNecklineTimeline } from "./necklineEarlyStudy.mjs";
import { completedDailyBars } from "./observedNecklineOverlay.mjs";

export const NECKLINE_QUALITY_VERSION = "NECKLINE_QUALITY_READONLY_V1";
export const NECKLINE_ROUND_TRIP_COST_PERCENT = 0.2;

function rounded(n) { return Math.round(n * 100) / 100; }
function describeStats(values) {
  const usable = values.filter(v => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (!usable.length) return { completed: 0, winRatePercent: null, meanPercent: null, medianPercent: null, worstPercent: null };
  return {
    completed: usable.length,
    winRatePercent: rounded(100 * usable.filter(x => x > 0).length / usable.length),
    meanPercent: rounded(usable.reduce((a,b) => a+b, 0) / usable.length),
    medianPercent: rounded(usable.length % 2 ? usable[(usable.length - 1) / 2]
      : (usable[usable.length/2 - 1] + usable[usable.length/2])/2),
    worstPercent: rounded(usable[0]),
  };
}

/**
 * An exploratory, point-in-time historical replay, NOT a forward trial.
 * Explicitly reports all events, including failed / pending outcomes, and
 * never filters the early cohort on what the future breakout turns out to be.
 *
 * Each symbol must have actual, complete, ordered daily OHLC bars.
 * Any invalid stock is excluded entirely; no synthetic prices or imputation.
 */
export function auditNecklineQuality(stocks, now = new Date()) {
  if (!Array.isArray(stocks) || stocks.length < 1 || stocks.length > 5
    || !Number.isFinite(now.getTime())) throw new Error("invalid cohort");
  const codes = stocks.map(s => s?.code);
  if (new Set(codes).size !== codes.length || codes.some(x => typeof x !== "string" || !/^[0-9]{4}$/.test(x))) {
    throw new Error("invalid stock codes");
  }

  const details = [];
  const events = [];
  let completedSymbols = 0;
  let totalBars = 0;
  let earliest = null, latest = null;
  for (const stock of stocks) {
    const inputBars = Array.isArray(stock.candles) ? stock.candles : [];
    const closed = completedDailyBars(inputBars, now);
    if (stock.error || !closed || closed.length < 25) {
      details.push({
        code: stock.code, status: "EXCLUDED", reason: stock.error || "25本以上の有効な確定日足が必要です",
        barCount: 0, candidateCount: 0, latestDate: null,
      });
      continue;
    }
    const report = analyzeNecklineTimeline(closed, NECKLINE_ROUND_TRIP_COST_PERCENT);
    if (!report.dataValid) {
      details.push({ code: stock.code, status: "EXCLUDED", reason: "日足を検証できません", barCount: 0, candidateCount: 0, latestDate: null });
      continue;
    }
    completedSymbols++;
    totalBars += closed.length;
    const date = index => new Date(closed[index].time * 1000).toLocaleDateString("sv-SE", {timeZone:"Asia/Tokyo"});
    const stockFirst = date(0), stockLast = date(closed.length - 1);
    earliest = earliest === null ? stockFirst : (stockFirst < earliest ? stockFirst : earliest);
    latest = latest === null ? stockLast : (stockLast > latest ? stockLast : latest);
    details.push({
      code: stock.code, status: "OK", reason: null, barCount: closed.length,
      candidateCount: report.events.length, latestDate: stockLast,
    });
    for (const e of report.events) {
      events.push({
        code: stock.code,
        low1Date: e.low1Date, low2Date: e.low2Date,
        firstSeenDate: e.firstSeenDate, breakoutDate: e.breakoutDate,
        low1: rounded(e.low1), low2: rounded(e.low2), neckline: rounded(e.neckline),
        status: e.status, leadSessions: e.leadSessions,
        earlyReturn3: e.earlyReturn3 == null ? null : rounded(e.earlyReturn3),
        earlyReturn5: e.earlyReturn5 == null ? null : rounded(e.earlyReturn5),
        breakoutReturn3: e.breakoutReturn3 == null ? null : rounded(e.breakoutReturn3),
        breakoutReturn5: e.breakoutReturn5 == null ? null : rounded(e.breakoutReturn5),
        volumeRatio: e.breakoutVolumeRatio == null ? null : rounded(e.breakoutVolumeRatio),
      });
    }
  }

  const byStatus = {
    watch: events.filter(e => e.status === "WATCH").length,
    breakout: events.filter(e => e.status === "BREAKOUT").length,
    invalidated: events.filter(e => e.status === "INVALIDATED").length,
    expired: events.filter(e => e.status === "EXPIRED").length,
  };
  const decided = byStatus.breakout + byStatus.invalidated + byStatus.expired;
  return {
    version: NECKLINE_QUALITY_VERSION,
    source: "YAHOO_CHART_1D_READONLY_EXPLICIT_REQUEST",
    replayOnly: true,
    costPercentPoints: NECKLINE_ROUND_TRIP_COST_PERCENT,
    requestedSymbols: stocks.length,
    usableSymbols: completedSymbols,
    excludedSymbols: stocks.length - completedSymbols,
    completedDailyBars: totalBars,
    earliestDate: earliest, latestDate: latest,
    candidates: events.length,
    byStatus, decidedCandidates: decided, pendingCandidates: byStatus.watch,
    resolvedBreakoutPercent: decided ? rounded(100 * byStatus.breakout / decided) : null,
    early3: describeStats(events.map(e => e.earlyReturn3)),
    early5: describeStats(events.map(e => e.earlyReturn5)),
    breakout3: describeStats(events.map(e => e.breakoutReturn3)),
    breakout5: describeStats(events.map(e => e.breakoutReturn5)),
    details,
    events: events.sort((a, b) => b.firstSeenDate.localeCompare(a.firstSeenDate) || a.code.localeCompare(b.code)),
  };
}
