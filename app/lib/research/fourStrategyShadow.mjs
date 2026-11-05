/**
 * SIGNALX four-pattern comparative research. SHADOW ONLY.
 * No market requests, orders, notifications, DB writes or AI POWER changes.
 * All signals are computed from closed candles at/before the observation bar.
 * Outcomes are computed separately, beginning at the NEXT bar open.
 */
import { detectHorizontalBreakoutAt } from './horizontalRetest.ts';

export const FOUR_PATTERN_VERSION = 'four_patterns_shadow_v1';
export const FOUR_PATTERN_IDS = Object.freeze([
  'BREAKOUT_RETEST', 'EMA_COMPRESSION', 'HIGHER_LOW', 'QUALITY_PULLBACK',
]);
export const FOUR_PATTERN_LABELS = Object.freeze({
  BREAKOUT_RETEST: '水平線ブレイク→戻り反発',
  EMA_COMPRESSION: 'EMA収縮→上抜け',
  HIGHER_LOW: '二番底・安値切り上げ',
  QUALITY_PULLBACK: '業績優良株の押し目',
});
export const FOUR_PATTERN_RULES = Object.freeze({
  horizons: [1, 3, 5], perSideFriction: 0.001, shares: 100,
  maxBudgetYen: 500000, overlapBars: 5,
});
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const round = (v, digits = 3) => Number(v.toFixed(digits));
const validNumber = n => typeof n === 'number' && Number.isFinite(n);
const positive = n => validNumber(n) && n > 0;

export function auditFourPatternCandles(candles) {
  if (!Array.isArray(candles) || candles.length < 80 || candles.length > 2000)
    return 'INSUFFICIENT_OR_EXCESSIVE_HISTORY';
  for (let i = 0; i < candles.length; i++) {
    const b = candles[i];
    if (!b || !Number.isSafeInteger(b.time) || b.time <= 0 ||
        ![b.open, b.high, b.low, b.close].every(positive) ||
        !validNumber(b.volume) || b.volume < 0 ||
        b.low > Math.min(b.open, b.close) ||
        b.high < Math.max(b.open, b.close) ||
        (i && b.time <= candles[i - 1].time)) return 'INVALID_OHLCV_OR_ORDER';
    if (i && (Math.abs(b.open / candles[i - 1].close - 1) > 0.45 ||
              Math.abs(b.close / candles[i - 1].close - 1) > 0.45))
      return 'CORPORATE_ACTION_OR_PRICE_GAP_REVIEW';
  }
  return null;
}
function emaSeries(candles, period) {
  const result = Array(candles.length).fill(null);
  let last = 0;
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue;
    if (i === period - 1) last = mean(candles.slice(0, period).map(b => b.close));
    else last = candles[i].close * (2 / (period + 1)) + last * (1 - 2 / (period + 1));
    result[i] = last;
  }
  return result;
}
function volumeRatio(c, i) {
  if (i < 20) return null;
  const before = c.slice(i - 20, i).map(b => b.volume);
  if (before.some(v => !positive(v)) || !positive(c[i].volume)) return null;
  return c[i].volume / mean(before);
}
function breakoutRetest(c, i) {
  if (!(c[i].close > c[i].open)) return null;
  for (let k = i - 1; k >= Math.max(60, i - 5); k--) {
    const hit = detectHorizontalBreakoutAt(c, k);
    if (!hit) continue;
    if (c.slice(k + 1, i).some(b => b.close < hit.level * 0.982)) continue;
    if (c[i].low < hit.level * 0.97 || c[i].low > hit.level * 1.012 ||
        c[i].close < hit.level * 1.002) continue;
    return { level: hit.level, breakoutTime: c[k].time, touches: hit.touches,
      breakoutVolumeRatio: hit.volumeRatio };
  }
  return null;
}
function emaCompression(c, i, e9, e21, e50) {
  const prev = [e9[i - 1], e21[i - 1], e50[i - 1]];
  if (prev.some(x => !positive(x))) return null;
  const spread = (Math.max(...prev) / Math.min(...prev) - 1) * 100;
  const ratio = volumeRatio(c, i);
  const recentHigh = Math.max(...c.slice(i - 12, i).map(x => x.high));
  if (spread > 1.6 || ratio === null || ratio < 1.2 ||
      c[i].close <= recentHigh || c[i].close <= e9[i] ||
      e9[i] < e21[i] || c[i].close <= c[i].open) return null;
  return { spreadPercent: round(spread), volumeRatio: round(ratio),
    priorHigh: round(recentHigh), ema9: round(e9[i]), ema21: round(e21[i]) };
}
function higherLow(c, i, e9) {
  if (c[i].close <= c[i].open || c[i].close <= c[i - 1].high ||
      c[i].close <= e9[i]) return null;
  // The second low must already have closed BEFORE the confirmation bar.
  for (let j = i - 2; j >= Math.max(25, i - 5); j--) {
    if (c[j].low > c[j - 1].low || c[j].low > c[j + 1].low) continue;
    for (let k = j - 5; k >= Math.max(2, i - 35); k--) {
      if (c[k].low > c[k - 1].low || c[k].low > c[k + 1].low) continue;
      const rise = c[j].low / c[k].low - 1;
      if (rise < 0 || rise > 0.05) continue;
      if (Math.min(...c.slice(k, i).map(x => x.low)) < c[k].low * 0.995) continue;
      return { firstLowTime: c[k].time, secondLowTime: c[j].time,
        firstLow: c[k].low, secondLow: c[j].low,
        higherLowPercent: round(rise * 100) };
    }
  }
  return null;
}
export function verifiedFundamentalsAt(fundamentals, time) {
  if (!Array.isArray(fundamentals)) return null;
  const eligible = fundamentals.filter(f => f && Number.isSafeInteger(f.publishedAt) &&
    f.publishedAt > 0 && f.publishedAt <= time &&
    [f.revenueGrowthPct, f.operatingProfitGrowthPct, f.equityRatioPct,
     f.operatingCashFlowYen].every(validNumber));
  eligible.sort((a, b) => b.publishedAt - a.publishedAt);
  const f = eligible[0];
  if (!f || f.revenueGrowthPct < 5 || f.operatingProfitGrowthPct < 5 ||
      f.equityRatioPct < 30 || f.operatingCashFlowYen <= 0) return null;
  return { publishedAt: f.publishedAt,
    revenueGrowthPct: f.revenueGrowthPct,
    operatingProfitGrowthPct: f.operatingProfitGrowthPct,
    equityRatioPct: f.equityRatioPct };
}
function qualityPullback(c, i, e9, fundamentals) {
  const quality = verifiedFundamentalsAt(fundamentals, c[i].time);
  if (!quality || !(c[i].close > c[i].open) ||
      !(c[i - 1].close <= e9[i - 1] && c[i].close > e9[i])) return null;
  const high = Math.max(...c.slice(i - 60, i).map(x => x.high));
  const drawdown = (1 - c[i].low / high) * 100;
  const maNow = mean(c.slice(i - 74, i + 1).map(b => b.close));
  const maPrior = mean(c.slice(i - 79, i - 4).map(b => b.close));
  if (drawdown < 7 || drawdown > 25 || maNow <= maPrior) return null;
  return { high: round(high), drawdownPercent: round(drawdown),
    ma75: round(maNow), fundamentals: quality };
}
function outcome(c, i, h) {
  const entry = c[i + 1], exit = c[i + h];
  if (!entry || !exit) return { horizon: h, status: 'PENDING',
    returnPercent: null, profitYen100: null, worstAdversePercent: null,
    entryTime: entry?.time ?? null, exitTime: null, budgetEligible: null };
  const buy = entry.open * (1 + FOUR_PATTERN_RULES.perSideFriction);
  const sell = exit.close * (1 - FOUR_PATTERN_RULES.perSideFriction);
  const lows = c.slice(i + 1, i + h + 1).map(b => b.low);
  return { horizon: h, status: 'HISTORICAL_ONLY',
    returnPercent: round((sell / buy - 1) * 100),
    profitYen100: Math.round((sell - buy) * FOUR_PATTERN_RULES.shares),
    worstAdversePercent: round((Math.min(...lows) / buy - 1) * 100),
    entryTime: entry.time, exitTime: exit.time,
    entryPrice: round(buy), budgetEligible:
      buy * FOUR_PATTERN_RULES.shares <= FOUR_PATTERN_RULES.maxBudgetYen };
}
export function signalAtFourPatterns({ candles, fundamentals = [], index }) {
  if (!Number.isInteger(index) || index < 79 || index >= candles.length ||
      auditFourPatternCandles(candles.slice(0, index + 1)) !== null)
    return [];
  const e9 = emaSeries(candles.slice(0, index + 1), 9);
  const e21 = emaSeries(candles.slice(0, index + 1), 21);
  const e50 = emaSeries(candles.slice(0, index + 1), 50);
  const detectors = [
    ['BREAKOUT_RETEST', () => breakoutRetest(candles, index)],
    ['EMA_COMPRESSION', () => emaCompression(candles, index, e9, e21, e50)],
    ['HIGHER_LOW', () => higherLow(candles, index, e9)],
    ['QUALITY_PULLBACK', () => qualityPullback(candles, index, e9, fundamentals)],
  ];
  return detectors.flatMap(([strategy, fn]) => {
    const evidence = fn();
    return evidence ? [{ strategy, index, signalTime: candles[index].time,
      signalClose: candles[index].close, evidence }] : [];
  });
}
/** Daily results use 1/3/5 trading sessions; intraday results use 1/3/5 bars. */
export function studyFourPatterns({ code, timeframe = '1D', candles,
    fundamentals = [], source = 'UNVERIFIED_HISTORICAL' } = {}) {
  if (typeof code !== 'string' || !/^[0-9]{3}[0-9A-Z]$/.test(code) ||
      !['1D', '30m', '60m'].includes(timeframe))
    return { status: 'INVALID_CODE_OR_TIMEFRAME', rows: [], summaries: [] };
  const reason = auditFourPatternCandles(candles);
  if (reason) return { status: reason, rows: [], summaries: [] };
  const rows = [], seen = new Map();
  for (let i = 79; i < candles.length; i++) {
    for (const signal of signalAtFourPatterns({ candles: candles.slice(0, i + 1),
        fundamentals, index: i })) {
      if (i - (seen.get(signal.strategy) ?? -Infinity) < FOUR_PATTERN_RULES.overlapBars) continue;
      seen.set(signal.strategy, i);
      rows.push({ code, timeframe, ...signal,
        outcomes: FOUR_PATTERN_RULES.horizons.map(h => outcome(candles, i, h)) });
    }
  }
  const summaries = FOUR_PATTERN_IDS.map(strategy => {
    const relevant = rows.filter(r => r.strategy === strategy);
    const done = relevant.flatMap(r => r.outcomes.filter(x =>
      x.horizon === 5 && x.status === 'HISTORICAL_ONLY' && x.budgetEligible));
    return { strategy, signals: relevant.length, measured5: done.length,
      pending5: relevant.filter(r => r.outcomes.find(x => x.horizon === 5)?.status === 'PENDING').length,
      budgetExcluded5: relevant.filter(r => r.outcomes.find(x =>
        x.horizon === 5 && x.status === 'HISTORICAL_ONLY' && !x.budgetEligible)).length,
      winRate5Percent: done.length ? round(done.filter(x => x.profitYen100 > 0).length / done.length * 100, 2) : null,
      averageReturn5Percent: done.length ? round(mean(done.map(x => x.returnPercent))) : null,
      averageProfit5Yen100: done.length ? Math.round(mean(done.map(x => x.profitYen100))) : null,
      worstAdverse5Percent: done.length ? round(Math.min(...done.map(x => x.worstAdversePercent))) : null };
  });
  return { version: FOUR_PATTERN_VERSION, status: 'OFFLINE_SHADOW_ONLY',
    code, timeframe, candleCount: candles.length, source,
    metricsUnit: timeframe === '1D' ? 'TRADING_SESSIONS' : 'BARS',
    fundamentalsCoverage: fundamentals.length ? 'USER_SUPPLIED_UNVERIFIED' : 'MISSING',
    actualAtDecisionTimeProvenanceVerified: false,
    eligibleForNotifications: false, eligibleForAiPower: false, eligibleForLiveOrders: false,
    rules: FOUR_PATTERN_RULES, summaries, rows };
}
