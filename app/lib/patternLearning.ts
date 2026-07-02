export type PatternInput = {
  rsi: number;
  trend: string;
  price: number;
  ema20: number | null;
  vwap: number | null;
  macd: number | null;
  macdSignal: number | null;
};

export type PatternLearningResult = {
  rsiBand: string;
  trendKey: string;
  ema20Key: string;
  vwapKey: string;
  macdKey: string;
  patternKey: string;
};

export function getRsiBand(rsi: number) {
  if (rsi < 30) return "RSI_UNDER_30";
  if (rsi < 45) return "RSI_30_44";
  if (rsi <= 60) return "RSI_45_60";
  if (rsi <= 75) return "RSI_61_75";
  if (rsi <= 85) return "RSI_76_85";
  return "RSI_OVER_85";
}

export function getTrendKey(trend: string) {
  if (trend === "UPTREND") return "TREND_UP";
  if (trend === "DOWNTREND") return "TREND_DOWN";
  return "TREND_NO_DATA";
}

export function getEma20Key(price: number, ema20: number | null) {
  if (ema20 === null) return "EMA20_NO_DATA";
  if (price > ema20) return "EMA20_ABOVE";
  return "EMA20_BELOW";
}

export function getVwapKey(price: number, vwap: number | null) {
  if (vwap === null) return "VWAP_NO_DATA";
  if (price > vwap) return "VWAP_ABOVE";
  return "VWAP_BELOW";
}

export function getMacdKey(macd: number | null, macdSignal: number | null) {
  if (macd === null || macdSignal === null) return "MACD_NO_DATA";
  if (macd > macdSignal) return "MACD_GC";
  return "MACD_DC";
}

export function buildPatternLearning(input: PatternInput): PatternLearningResult {
  const rsiBand = getRsiBand(input.rsi);
  const trendKey = getTrendKey(input.trend);
  const ema20Key = getEma20Key(input.price, input.ema20);
  const vwapKey = getVwapKey(input.price, input.vwap);
  const macdKey = getMacdKey(input.macd, input.macdSignal);

  const patternKey = [
    rsiBand,
    macdKey,
    vwapKey,
    ema20Key,
    trendKey,
  ].join("|");

  return {
    rsiBand,
    trendKey,
    ema20Key,
    vwapKey,
    macdKey,
    patternKey,
  };
}