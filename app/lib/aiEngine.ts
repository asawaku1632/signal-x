import {
  buildPatternLearning,
  type PatternLearningResult,
} from "./patternLearning";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type ChartAnalysis = {
  success: boolean;
  currentPrice: number | null;
  ma20: number | null;
  trend: string;
  candleSignal: string;
  patternSignal: string;
  patternScore: number;
  patternReasons: string[];
  candles: Candle[];
};

export type ScoreBreakdown = {
  momentum: number;
  lowPriceBonus: number;
  trend: number;
  ema: number;
  vwap: number;
  macd: number;
  pattern: number;
  candle: number;
  rsi: number;
  volume: number;
  patternBonus: number;
  learning: number;
};

export type AiResult = {
  code: string;
  name: string;
  score: number;
  price: number;
  changePercent: number;
  rsi: number;
  volumeRatio: number;
  trend: string;
  ma20: number | null;
  ema20: number | null;
  ema75: number | null;
  vwap: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  candleSignal: string;
  patternSignal: string;
  patternScore: number;
  patternReasons: string[];
  scoreBreakdown: ScoreBreakdown;
  reason: string;
  takeProfit: number;
  stopLoss: number;
  patternLearning: PatternLearningResult;
  patternKey: string;
};

export function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateRsi(closes: number[], period = 14): number {
  if (closes.length <= period) return 50;

  let gains = 0;
  let losses = 0;
  const target = closes.slice(-period - 1);

  for (let i = 1; i < target.length; i++) {
    const diff = target[i] - target[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  if (losses === 0) return 70;

  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgGain / avgLoss;

  return Math.round(100 - 100 / (1 + rs));
}

export function calculateVolumeRatio(candles: Candle[]) {
  if (candles.length < 2) return 1;

  const volumes = candles
    .map((candle) => candle.volume ?? 0)
    .filter((volume) => volume > 0);

  if (volumes.length < 2) return 1;

  const latest = volumes[volumes.length - 1];

  const average =
    volumes.slice(0, -1).reduce((sum, value) => sum + value, 0) /
    Math.max(volumes.length - 1, 1);

  if (!average) return 1;

  return Number((latest / average).toFixed(2));
}

export function calculateEma(values: number[], period: number) {
  if (values.length < period) return null;

  const multiplier = 2 / (period + 1);
  let ema =
    values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
  }

  return Number(ema.toFixed(2));
}

export function calculateVwap(candles: Candle[]) {
  let totalPriceVolume = 0;
  let totalVolume = 0;

  for (const candle of candles) {
    const volume = candle.volume ?? 0;
    if (volume <= 0) continue;

    const typicalPrice = (candle.high + candle.low + candle.close) / 3;

    totalPriceVolume += typicalPrice * volume;
    totalVolume += volume;
  }

  if (totalVolume <= 0) return null;

  return Number((totalPriceVolume / totalVolume).toFixed(2));
}

export function calculateMacd(closes: number[]) {
  if (closes.length < 35) {
    return {
      macd: null,
      signal: null,
      histogram: null,
    };
  }

  const ema12Series = buildEmaSeries(closes, 12);
  const ema26Series = buildEmaSeries(closes, 26);

  const macdLine = closes.map((_, index) => {
    const ema12 = ema12Series[index];
    const ema26 = ema26Series[index];

    if (ema12 === null || ema26 === null) return null;

    return ema12 - ema26;
  });

  const validMacd = macdLine.filter((value): value is number => value !== null);
  const signal = calculateEma(validMacd, 9);
  const macd = validMacd[validMacd.length - 1] ?? null;

  if (macd === null || signal === null) {
    return {
      macd: null,
      signal: null,
      histogram: null,
    };
  }

  return {
    macd: Number(macd.toFixed(2)),
    signal: Number(signal.toFixed(2)),
    histogram: Number((macd - signal).toFixed(2)),
  };
}

function buildEmaSeries(values: number[], period: number) {
  const result: Array<number | null> = Array(values.length).fill(null);

  if (values.length < period) return result;

  const multiplier = 2 / (period + 1);

  let ema =
    values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  result[period - 1] = ema;

  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
    result[i] = ema;
  }

  return result;
}

export function calculateAiScore(params: {
  code: string;
  name: string;
  price: number;
  previousClose: number | null;
  chart: ChartAnalysis | null;
}): AiResult {
  const { code, name, price, previousClose, chart } = params;

  const changePercent =
    previousClose && previousClose > 0
      ? ((price - previousClose) / previousClose) * 100
      : 0;

  const candles = chart?.candles ?? [];
  const closes = candles.map((candle) => candle.close).filter(Boolean);

  const rsi = calculateRsi(closes);
  const volumeRatio = calculateVolumeRatio(candles);
  const ema20 = calculateEma(closes, 20);
  const ema75 = calculateEma(closes, 75);
  const vwap = calculateVwap(candles);
  const macdData = calculateMacd(closes);

  const patternLearning = buildPatternLearning({
    rsi,
    trend: chart?.trend ?? "NO_DATA",
    price,
    ema20,
    vwap,
    macd: macdData.macd,
    macdSignal: macdData.signal,
  });

  const breakdown: ScoreBreakdown = {
    momentum: 0,
    lowPriceBonus: 0,
    trend: 0,
    ema: 0,
    vwap: 0,
    macd: 0,
    pattern: 0,
    candle: 0,
    rsi: 0,
    volume: 0,
    patternBonus: 0,
    learning: 0,
  };

  let score = 35;
  const reasons: string[] = [];

  if (changePercent >= 4) {
    breakdown.momentum = 16;
    reasons.push("上昇率が非常に強い");
  } else if (changePercent >= 2.5) {
    breakdown.momentum = 12;
    reasons.push("上昇率が強い");
  } else if (changePercent >= 1.2) {
    breakdown.momentum = 6;
    reasons.push("上昇傾向");
  } else if (changePercent <= -3) {
    breakdown.momentum = -18;
    reasons.push("下落が強い");
  } else if (changePercent <= -1.5) {
    breakdown.momentum = -8;
    reasons.push("弱含み");
  } else {
    reasons.push("値動きは通常範囲");
  }

  if (price > 0 && price <= 1000) {
    breakdown.lowPriceBonus = 3;
    reasons.push("10万円以下で100株を狙いやすい");
  }

  if (chart?.trend === "UPTREND") {
    breakdown.trend = 7;
    reasons.push("MA20上で推移");
  }

  if (chart?.trend === "DOWNTREND") {
    breakdown.trend = -12;
    reasons.push("MA20下で推移");
  }

  if (ema20 !== null && price > ema20) {
    breakdown.ema += 3;
    reasons.push("EMA20上で推移");
  }

  if (ema75 !== null && price > ema75) {
    breakdown.ema += 4;
    reasons.push("EMA75上で推移");
  }

  if (vwap !== null && price > vwap * 1.003) {
    breakdown.vwap = 5;
    reasons.push("VWAP上で推移");
  } else if (vwap !== null && price > vwap) {
    breakdown.vwap = 2;
    reasons.push("VWAP付近で推移");
  } else if (vwap !== null && price < vwap) {
    breakdown.vwap = -6;
    reasons.push("VWAP下で推移");
  }

  if (
    macdData.macd !== null &&
    macdData.signal !== null &&
    macdData.macd > macdData.signal &&
    (macdData.histogram ?? 0) > 0.2
  ) {
    breakdown.macd = 6;
    reasons.push("MACDがシグナル上抜け");
  } else if (
    macdData.macd !== null &&
    macdData.signal !== null &&
    macdData.macd > macdData.signal
  ) {
    breakdown.macd = 3;
    reasons.push("MACDがやや上向き");
  } else if (
    macdData.macd !== null &&
    macdData.signal !== null &&
    macdData.macd < macdData.signal
  ) {
    breakdown.macd = -8;
    reasons.push("MACDがシグナル下回り");
  }

  if (chart?.patternSignal === "W_BOTTOM") {
    breakdown.pattern = 10;
    reasons.push("Wボトム候補");
  }

  if (chart?.patternSignal === "W_BOTTOM_BREAK") {
    breakdown.pattern = volumeRatio >= 2 ? 14 : 8;
    reasons.push("Wボトム突破");
  }

  if (chart?.candleSignal === "BULLISH_ENGULFING") {
    breakdown.candle = 8;
    reasons.push("買い包み足");
  }

  if (chart?.candleSignal === "BEARISH_ENGULFING") {
    breakdown.candle = -12;
    reasons.push("売り包み足");
  }

  if (rsi >= 45 && rsi <= 62) {
    breakdown.rsi = 5;
    reasons.push(`RSI${rsi}で過熱感は適正`);
  } else if (rsi <= 30) {
    breakdown.rsi = 4;
    reasons.push(`RSI${rsi}で反発期待`);
  } else if (rsi >= 85) {
    breakdown.rsi = -30;
    reasons.push(`RSI${rsi}で強い買われ過ぎ注意`);
  } else if (rsi >= 80) {
    breakdown.rsi = -20;
    reasons.push(`RSI${rsi}で買われ過ぎ注意`);
  } else if (rsi >= 75) {
    breakdown.rsi = -12;
    reasons.push(`RSI${rsi}でやや過熱`);
  }

  if (volumeRatio >= 3) {
    breakdown.volume = 8;
    reasons.push(`出来高${volumeRatio}倍`);
  } else if (volumeRatio >= 2) {
    breakdown.volume = 5;
    reasons.push(`出来高${volumeRatio}倍`);
  } else if (volumeRatio >= 1.5) {
    breakdown.volume = 3;
    reasons.push(`出来高${volumeRatio}倍で増加傾向`);
  }

  if (chart?.patternScore) {
    breakdown.patternBonus = Math.max(
      -6,
      Math.min(8, Math.round(chart.patternScore * 0.15))
    );
  }

  score +=
    breakdown.momentum +
    breakdown.lowPriceBonus +
    breakdown.trend +
    breakdown.ema +
    breakdown.vwap +
    breakdown.macd +
    breakdown.pattern +
    breakdown.candle +
    breakdown.rsi +
    breakdown.volume +
    breakdown.patternBonus +
    breakdown.learning;

  score = clampScore(score);

  return {
    code,
    name,
    score,
    price,
    changePercent: Number(changePercent.toFixed(2)),
    rsi,
    volumeRatio,
    trend: chart?.trend ?? "NO_DATA",
    ma20: chart?.ma20 ?? null,
    ema20,
    ema75,
    vwap,
    macd: macdData.macd,
    macdSignal: macdData.signal,
    macdHistogram: macdData.histogram,
    candleSignal: chart?.candleSignal ?? "NONE",
    patternSignal: chart?.patternSignal ?? "NONE",
    patternScore: chart?.patternScore ?? 0,
    patternReasons: chart?.patternReasons ?? [],
    scoreBreakdown: breakdown,
    reason: Array.from(new Set(reasons)).slice(0, 8).join("・"),
    takeProfit: Math.round(price * 1.03),
    stopLoss: Math.round(price * 0.98),
    patternLearning,
    patternKey: patternLearning.patternKey,
  };
}