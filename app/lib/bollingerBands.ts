export const BOLLINGER_PERIOD = 20 as const;
export const BOLLINGER_SIGMA = 2 as const;

const NEAR_THRESHOLD_PERCENT = 1;
const BAND_WALK_LOOKBACK = 5;
const BAND_WALK_TOUCH_COUNT = 3;
const BAND_WALK_CLOSE_COUNT = 2;
const VOLUME_INCREASE_RATIO = 1.3;
const RSI_OVERSOLD = 30;
const RSI_OVERHEATED = 70;
const SLOPE_LOOKBACK = 5;
const CLEAR_SLOPE_PERCENT = 0.5;

export type BollingerSide = "LOWER_REBOUND" | "UPPER_OVERHEAT" | "NONE";
export type BollingerStatus =
  | "NEAR"
  | "TOUCHED"
  | "BREACHED"
  | "CONFIRMED"
  | "NONE";
export type BandWalkRisk = "LOW" | "MEDIUM" | "HIGH";
export type UpperBollingerRegime =
  | "UPPER_TREND"
  | "UPPER_WATCH"
  | "UPPER_REVERSAL";

export type BollingerSnapshot = {
  period: number;
  sigma: number;
  middle: number;
  upper: number;
  lower: number;
  /** Existing pattern-engine compatible width ratio (for example 0.04 = 4%). */
  width: number;
  bandWidthPercent: number;
};

export type BollingerSignal = Omit<
  BollingerSnapshot,
  "width" | "period" | "sigma"
> & {
  period: typeof BOLLINGER_PERIOD;
  sigma: typeof BOLLINGER_SIGMA;
  side: BollingerSide;
  status: BollingerStatus;
  expectation: number;
  distancePercent: number;
  bandWalkRisk: BandWalkRisk;
  upperRegime?: UpperBollingerRegime;
  tradeDate?: string;
  confirmations: string[];
  warnings: string[];
};

type EvaluateBollingerOptions = {
  patterns?: Array<{ direction: "BUY" | "SELL" | "NEUTRAL" }>;
  supportResistanceStatus?: string;
};

type BollingerReversalEvidence = {
  lower: boolean;
  upper: boolean;
};

export type BollingerCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculatePopulationStandardDeviation(
  values: number[],
  mean: number,
) {
  if (values.length === 0) return 0;
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      values.length,
  );
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function toJstTradeDate(unixSeconds: number) {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return undefined;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(unixSeconds * 1_000));
}

export function calculateBollingerSnapshot(
  closes: number[],
  endExclusive = closes.length,
  period: number = BOLLINGER_PERIOD,
  sigma: number = BOLLINGER_SIGMA,
  requirePositiveDeviation = true,
): BollingerSnapshot | null {
  if (
    endExclusive < period ||
    endExclusive > closes.length ||
    period < 2 ||
    sigma <= 0
  ) {
    return null;
  }

  const window = closes.slice(endExclusive - period, endExclusive);
  if (window.some((value) => !Number.isFinite(value) || value <= 0)) return null;

  const middle = average(window);
  const deviation = calculatePopulationStandardDeviation(window, middle);
  if (middle <= 0 || (requirePositiveDeviation && deviation <= 0)) return null;

  const upper = middle + deviation * sigma;
  const lower = middle - deviation * sigma;

  return {
    period,
    sigma,
    middle,
    upper,
    lower,
    width: (upper - lower) / middle,
    bandWidthPercent: ((upper - lower) / middle) * 100,
  };
}

function calculateEmaSeries(values: number[], period: number) {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length < period) return result;

  const multiplier = 2 / (period + 1);
  let ema = average(values.slice(0, period));
  result[period - 1] = ema;

  for (let index = period; index < values.length; index++) {
    ema = (values[index] - ema) * multiplier + ema;
    result[index] = ema;
  }
  return result;
}

function calculateRsiSeries(values: number[], period = 14) {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length <= period) return result;

  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index++) {
    const difference = values[index] - values[index - 1];
    gains += Math.max(difference, 0);
    losses += Math.max(-difference, 0);
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;
  result[period] = averageLoss === 0
    ? 100
    : 100 - 100 / (1 + averageGain / averageLoss);

  for (let index = period + 1; index < values.length; index++) {
    const difference = values[index] - values[index - 1];
    averageGain =
      (averageGain * (period - 1) + Math.max(difference, 0)) / period;
    averageLoss =
      (averageLoss * (period - 1) + Math.max(-difference, 0)) / period;
    result[index] = averageLoss === 0
      ? 100
      : 100 - 100 / (1 + averageGain / averageLoss);
  }
  return result;
}

function calculateMacdHistogramSeries(values: number[]) {
  const ema12 = calculateEmaSeries(values, 12);
  const ema26 = calculateEmaSeries(values, 26);
  const macdValues: number[] = [];
  const macdIndexes: number[] = [];

  for (let index = 0; index < values.length; index++) {
    if (ema12[index] === null || ema26[index] === null) continue;
    macdValues.push(ema12[index]! - ema26[index]!);
    macdIndexes.push(index);
  }

  const signal = calculateEmaSeries(macdValues, 9);
  const result: Array<number | null> = Array(values.length).fill(null);
  for (let index = 0; index < macdValues.length; index++) {
    if (signal[index] !== null) {
      result[macdIndexes[index]] = macdValues[index] - signal[index]!;
    }
  }
  return result;
}

function getVolumeRatio(candles: BollingerCandle[]) {
  const recent = candles.slice(-21);
  const latest = recent.at(-1)?.volume ?? 0;
  const history = recent
    .slice(0, -1)
    .map((candle) => candle.volume ?? 0)
    .filter((volume) => volume > 0);
  const mean = average(history);
  return latest > 0 && mean > 0 ? latest / mean : 1;
}

export function classifyBollingerPosition(
  latest: BollingerCandle,
  current: BollingerSnapshot,
  previous: BollingerCandle | undefined,
  previousBands: BollingerSnapshot | null,
  reversalEvidence: BollingerReversalEvidence = {
    lower: false,
    upper: false,
  },
) {
  const lowerDistance = ((latest.low - current.lower) / current.lower) * 100;
  const upperDistance = ((current.upper - latest.high) / current.upper) * 100;

  const lowerReturnedInside =
    latest.close >= current.lower &&
    (latest.low <= current.lower ||
      Boolean(previous && previousBands && previous.close < previousBands.lower));
  const upperReturnedInside =
    latest.close <= current.upper &&
    (latest.high >= current.upper ||
      Boolean(previous && previousBands && previous.close > previousBands.upper));
  const lowerConfirmed = lowerReturnedInside && reversalEvidence.lower;
  const upperConfirmed = upperReturnedInside && reversalEvidence.upper;

  const lowerStatus: BollingerStatus = lowerConfirmed
    ? "CONFIRMED"
    : latest.close < current.lower
      ? "BREACHED"
      : lowerReturnedInside
        ? "TOUCHED"
        : lowerDistance >= 0 && lowerDistance <= NEAR_THRESHOLD_PERCENT
          ? "NEAR"
          : "NONE";
  const upperStatus: BollingerStatus = upperConfirmed
    ? "CONFIRMED"
    : latest.close > current.upper
      ? "BREACHED"
      : upperReturnedInside
        ? "TOUCHED"
        : upperDistance >= 0 && upperDistance <= NEAR_THRESHOLD_PERCENT
          ? "NEAR"
          : "NONE";

  if (lowerStatus !== "NONE" && upperStatus !== "NONE") {
    return Math.abs(lowerDistance) >= Math.abs(upperDistance)
      ? { side: "LOWER_REBOUND" as const, status: lowerStatus }
      : { side: "UPPER_OVERHEAT" as const, status: upperStatus };
  }
  if (lowerStatus !== "NONE") {
    return { side: "LOWER_REBOUND" as const, status: lowerStatus };
  }
  if (upperStatus !== "NONE") {
    return { side: "UPPER_OVERHEAT" as const, status: upperStatus };
  }
  return { side: "NONE" as const, status: "NONE" as const };
}

function getSlopePercent(current: number, earlier: number) {
  return earlier === 0 ? 0 : ((current - earlier) / Math.abs(earlier)) * 100;
}

export function evaluateDailyBollingerSignal(
  inputCandles: BollingerCandle[],
  options: EvaluateBollingerOptions = {},
): BollingerSignal | null {
  const candles = inputCandles.filter(
    (candle) =>
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close) &&
      candle.close > 0,
  );
  if (candles.length < BOLLINGER_PERIOD) return null;

  const closes = candles.map((candle) => candle.close);
  const latest = candles.at(-1)!;
  const previous = candles.at(-2);
  const current = calculateBollingerSnapshot(closes);
  if (!current) return null;

  const previousBands = calculateBollingerSnapshot(closes, closes.length - 1);
  const earlierBands = calculateBollingerSnapshot(
    closes,
    closes.length - SLOPE_LOOKBACK,
  );
  const confirmations: string[] = [];
  const warnings: string[] = [];
  const rsi = calculateRsiSeries(closes);
  const latestRsi = rsi.at(-1);
  const previousRsi = rsi.at(-2);
  const histogram = calculateMacdHistogramSeries(closes);
  const latestHistogram = histogram.at(-1);
  const previousHistogram = histogram.at(-2);
  const olderHistogram = histogram.at(-3);
  const ema20Series = calculateEmaSeries(closes, 20);
  const ema20 = ema20Series.at(-1);
  const earlierEma20 = ema20Series.at(-1 - SLOPE_LOOKBACK);
  const ema75 = calculateEmaSeries(closes, 75).at(-1);
  const volumeRatio = getVolumeRatio(candles);
  const bullishPatterns = (options.patterns ?? []).filter(
    (pattern) => pattern.direction === "BUY",
  );
  const bearishPatterns = (options.patterns ?? []).filter(
    (pattern) => pattern.direction === "SELL",
  );
  const maSlope = earlierBands
    ? getSlopePercent(current.middle, earlierBands.middle)
    : 0;
  const lowerSlope = earlierBands
    ? getSlopePercent(current.lower, earlierBands.lower)
    : 0;
  const upperSlope = earlierBands
    ? getSlopePercent(current.upper, earlierBands.upper)
    : 0;
  const body = Math.abs(latest.close - latest.open);
  const lowerWick = Math.min(latest.open, latest.close) - latest.low;
  const upperWick = latest.high - Math.max(latest.open, latest.close);
  const lowerReversalEvidence =
    latest.close > latest.open ||
    Boolean(previous && latest.close > previous.high) ||
    lowerWick >= Math.max(body * 1.5, latest.close * 0.003) ||
    Boolean(
      latestRsi != null &&
        previousRsi != null &&
        previousRsi <= RSI_OVERSOLD &&
        latestRsi > previousRsi,
    ) ||
    Boolean(
      latestHistogram != null &&
        previousHistogram != null &&
        latestHistogram > previousHistogram,
    );
  const upperReversalEvidence =
    latest.close < latest.open ||
    Boolean(previous && latest.close < previous.low) ||
    upperWick >= Math.max(body * 1.5, latest.close * 0.003) ||
    Boolean(
      latestRsi != null &&
        previousRsi != null &&
        latestRsi >= RSI_OVERHEATED &&
        latestRsi < previousRsi,
    ) ||
    Boolean(
      latestHistogram != null &&
        previousHistogram != null &&
        latestHistogram < previousHistogram,
    );
  const { side, status } = classifyBollingerPosition(
    latest,
    current,
    previous,
    previousBands,
    { lower: lowerReversalEvidence, upper: upperReversalEvidence },
  );

  const distancePercent = side === "NONE"
    ? Math.min(
        Math.abs(((latest.low - current.lower) / current.lower) * 100),
        Math.abs(((current.upper - latest.high) / current.upper) * 100),
      )
    : side === "UPPER_OVERHEAT"
      ? ((current.upper - latest.high) / current.upper) * 100
      : ((latest.low - current.lower) / current.lower) * 100;

  let expectation = status === "NEAR"
    ? 28
    : status === "TOUCHED"
      ? 36
      : status === "BREACHED"
        ? 32
        : status === "CONFIRMED"
          ? 52
          : 0;

  if (side === "LOWER_REBOUND") {
    if (status === "CONFIRMED") confirmations.push("終値が−2σ内側へ復帰");
    if (latest.close > latest.open) {
      confirmations.push("日足が陽線");
      expectation += 6;
    }
    if (lowerWick >= Math.max(body * 1.5, latest.close * 0.003)) {
      confirmations.push("長い下ヒゲを形成");
      expectation += 7;
    }
    if (previous && latest.close > previous.high) {
      confirmations.push("終値が前日高値を上回る");
      expectation += 7;
    }
    if (
      latestRsi != null &&
      previousRsi != null &&
      previousRsi <= RSI_OVERSOLD &&
      latestRsi > previousRsi
    ) {
      confirmations.push("日足RSIが売られすぎ圏から反転");
      expectation += 8;
    }
    if (
      latestHistogram != null &&
      previousHistogram != null &&
      latestHistogram > previousHistogram
    ) {
      confirmations.push("日足MACDヒストグラム改善");
      expectation += 7;
    }
    if (volumeRatio >= VOLUME_INCREASE_RATIO) {
      confirmations.push("日足出来高が増加");
      expectation += 5;
    }
    if (bullishPatterns.length > 0) {
      confirmations.push("強気チャートパターン検出");
      expectation += 7;
    }
    if (maSlope >= -CLEAR_SLOPE_PERCENT) {
      confirmations.push("日足MA20の傾きが横ばいまたは上向き");
      expectation += 5;
    }
  } else if (side === "UPPER_OVERHEAT") {
    if (status === "CONFIRMED") {
      confirmations.push("終値が＋2σ内側へ復帰");
      expectation += 8;
    }
    if (latest.close < latest.open) {
      confirmations.push("日足が陰線");
      expectation += 6;
    }
    if (previous && latest.close < previous.low) {
      confirmations.push("終値が前日安値を下回る");
      expectation += 7;
    }
    if (upperWick >= Math.max(body * 1.5, latest.close * 0.003)) {
      confirmations.push("長い上ヒゲを形成");
      expectation += 7;
    }
    if (
      latestRsi != null &&
      previousRsi != null &&
      latestRsi >= RSI_OVERHEATED &&
      latestRsi < previousRsi
    ) {
      confirmations.push("日足RSIが過熱圏から低下");
      expectation += 8;
    }
    if (
      latestHistogram != null &&
      previousHistogram != null &&
      latestHistogram < previousHistogram
    ) {
      confirmations.push("日足MACDヒストグラム悪化");
      expectation += 7;
    }
    if (volumeRatio >= VOLUME_INCREASE_RATIO) {
      confirmations.push("日足出来高が増加");
      expectation += 5;
    }
    if (bearishPatterns.length > 0) {
      confirmations.push("弱気チャートパターン検出");
      expectation += 7;
    }
  }

  const recent = candles.slice(-BAND_WALK_LOOKBACK);
  const recentBands = recent.map((_, index) =>
    calculateBollingerSnapshot(
      closes,
      closes.length - recent.length + index + 1,
    ),
  );
  const lowerTouches = recent.filter(
    (candle, index) =>
      recentBands[index] && candle.low <= recentBands[index]!.lower,
  ).length;
  const upperTouches = recent.filter(
    (candle, index) =>
      recentBands[index] && candle.high >= recentBands[index]!.upper,
  ).length;
  const consecutiveLowerCloses = recent
    .map((candle, index) =>
      recentBands[index] ? candle.close <= recentBands[index]!.lower : false,
    )
    .reverse()
    .findIndex((value) => !value);
  const lowerCloseCount = consecutiveLowerCloses === -1
    ? recent.length
    : consecutiveLowerCloses;
  const consecutiveUpperCloses = recent
    .map((candle, index) =>
      recentBands[index] ? candle.close >= recentBands[index]!.upper : false,
    )
    .reverse()
    .findIndex((value) => !value);
  const upperCloseCount = consecutiveUpperCloses === -1
    ? recent.length
    : consecutiveUpperCloses;

  let riskPoints = 0;
  if (side === "LOWER_REBOUND") {
    if (lowerTouches >= BAND_WALK_TOUCH_COUNT) {
      riskPoints += 2;
      warnings.push("直近5日で−2σへの接触が複数回");
    }
    if (lowerCloseCount >= BAND_WALK_CLOSE_COUNT) {
      riskPoints += 2;
      warnings.push("−2σ沿いの下落が継続");
    }
    if (maSlope <= -CLEAR_SLOPE_PERCENT) {
      riskPoints += 1;
      warnings.push("日足MA20が明確に下向き");
    }
    if (lowerSlope <= -CLEAR_SLOPE_PERCENT) {
      riskPoints += 1;
      warnings.push("下側バンドが下向き");
    }
    if (
      ema20 != null &&
      ema75 != null &&
      latest.close < ema20 &&
      ema20 < ema75
    ) {
      riskPoints += 2;
      warnings.push("price < EMA20 < EMA75の下降配列");
    }
    if (
      latestHistogram != null &&
      previousHistogram != null &&
      olderHistogram != null &&
      latestHistogram < previousHistogram &&
      previousHistogram < olderHistogram
    ) {
      riskPoints += 1;
      warnings.push("日足MACDヒストグラムが連続悪化");
    }
    if (bearishPatterns.length > bullishPatterns.length) {
      riskPoints += 2;
      warnings.push("弱気チャートパターン優勢");
    }
    if (options.supportResistanceStatus === "BREAKDOWN_RISK") {
      riskPoints += 2;
      warnings.push("支持線割れリスク");
    }
    if (latest.close <= current.lower) {
      riskPoints += 1;
      warnings.push("終値が−2σの外側");
    }
  } else if (side === "UPPER_OVERHEAT") {
    if (upperTouches >= BAND_WALK_TOUCH_COUNT) {
      riskPoints += 2;
      warnings.push("直近5日で＋2σへの接触が複数回");
    }
    if (upperCloseCount >= BAND_WALK_CLOSE_COUNT) {
      riskPoints += 2;
      warnings.push("＋2σ沿いの上昇が継続");
    }
    if (upperSlope >= CLEAR_SLOPE_PERCENT) riskPoints += 1;
    if (latest.close >= current.upper) warnings.push("終値が＋2σの外側");
  }

  const bandWalkRisk: BandWalkRisk = riskPoints >= 4
    ? "HIGH"
    : riskPoints >= 2
      ? "MEDIUM"
      : "LOW";
  if (bandWalkRisk === "HIGH") {
    warnings.push("バンドウォークリスク高");
    expectation = Math.min(expectation - 18, 35);
  } else if (bandWalkRisk === "MEDIUM") {
    warnings.push("バンドウォーク継続に注意");
    expectation = Math.min(expectation - 8, 60);
  }

  let upperRegime: UpperBollingerRegime | undefined;
  if (side === "UPPER_OVERHEAT") {
    const upperTrendPoints = [
      maSlope >= CLEAR_SLOPE_PERCENT,
      ema20 != null && earlierEma20 != null && ema20 > earlierEma20,
      latestHistogram != null &&
        previousHistogram != null &&
        latestHistogram >= previousHistogram,
      latest.close >= latest.open,
      volumeRatio >= VOLUME_INCREASE_RATIO,
    ].filter(Boolean).length;

    upperRegime = status === "CONFIRMED"
      ? "UPPER_REVERSAL"
      : upperTrendPoints >= 3
        ? "UPPER_TREND"
        : "UPPER_WATCH";
  }

  return {
    period: BOLLINGER_PERIOD,
    sigma: BOLLINGER_SIGMA,
    upper: round(current.upper),
    middle: round(current.middle),
    lower: round(current.lower),
    side,
    status,
    expectation: Math.round(clamp(expectation)),
    distancePercent: round(distancePercent),
    bandWidthPercent: round(current.bandWidthPercent),
    bandWalkRisk,
    upperRegime,
    tradeDate: toJstTradeDate(latest.time),
    confirmations: [...new Set(confirmations)],
    warnings: [...new Set(warnings)],
  };
}
