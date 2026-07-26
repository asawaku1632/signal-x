
export type PatternCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type PatternDirection = "BUY" | "SELL" | "NEUTRAL";

export type DetectedChartPattern = {
  id: string;
  name: string;
  direction: PatternDirection;
  confidence: number;
  score: number;
  reasons: string[];
};

type Pivot = {
  index: number;
  price: number;
};

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function percentDifference(a: number, b: number) {
  const base = Math.max(Math.abs(a), Math.abs(b), 0.0001);
  return Math.abs(a - b) / base;
}

function calculateEmaSeries(values: number[], period: number) {
  const result: Array<number | null> = Array(values.length).fill(null);

  if (values.length < period) return result;

  const multiplier = 2 / (period + 1);

  let ema =
    values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  result[period - 1] = ema;

  for (let index = period; index < values.length; index++) {
    ema = (values[index] - ema) * multiplier + ema;
    result[index] = ema;
  }

  return result;
}

function detectPivots(candles: PatternCandle[], windowSize = 2) {
  const highs: Pivot[] = [];
  const lows: Pivot[] = [];

  for (
    let index = windowSize;
    index < candles.length - windowSize;
    index++
  ) {
    const candle = candles[index];
    const window = candles.slice(
      index - windowSize,
      index + windowSize + 1
    );

    const highest = Math.max(...window.map((item) => item.high));
    const lowest = Math.min(...window.map((item) => item.low));

    if (candle.high >= highest) {
      highs.push({
        index,
        price: candle.high,
      });
    }

    if (candle.low <= lowest) {
      lows.push({
        index,
        price: candle.low,
      });
    }
  }

  return { highs, lows };
}

function getVolumeRatio(candles: PatternCandle[]) {
  if (candles.length < 6) return 1;

  const latest = candles[candles.length - 1];
  const previous = candles.slice(-21, -1);

  const averageVolume = average(
    previous
      .map((candle) => candle.volume ?? 0)
      .filter((volume) => volume > 0)
  );

  if (averageVolume <= 0) return 1;

  return (latest.volume ?? 0) / averageVolume;
}

function pushPattern(
  patterns: DetectedChartPattern[],
  pattern: DetectedChartPattern
) {
  const existing = patterns.find((item) => item.id === pattern.id);

  if (!existing) {
    patterns.push({
      ...pattern,
      confidence: Math.round(clamp(pattern.confidence)),
    });
  }
}

function detectDoubleBottom(
  candles: PatternCandle[],
  lows: Pivot[],
  volumeRatio: number,
  patterns: DetectedChartPattern[]
) {
  if (lows.length < 2) return;

  const first = lows[lows.length - 2];
  const second = lows[lows.length - 1];

  if (second.index - first.index < 4) return;

  const lowsClose = percentDifference(first.price, second.price) <= 0.025;
  const between = candles.slice(first.index, second.index + 1);

  if (!between.length) return;

  const neckline = Math.max(...between.map((candle) => candle.high));
  const latest = candles[candles.length - 1];

  const bounced = latest.close >= second.price * 1.01;
  const necklineBreak = latest.close >= neckline * 0.998;

  if (!lowsClose || !bounced) return;

  let confidence = 62;
  const reasons = ["近い価格帯で2回下げ止まり"];

  if (necklineBreak) {
    confidence += 18;
    reasons.push("ネックラインを上抜け");
  }

  if (volumeRatio >= 1.3) {
    confidence += 8;
    reasons.push("出来高増加");
  }

  pushPattern(patterns, {
    id: "pattern002",
    name: "ダブルボトム反発",
    direction: "BUY",
    confidence,
    score: 25,
    reasons,
  });
}

function detectDoubleTop(
  candles: PatternCandle[],
  highs: Pivot[],
  volumeRatio: number,
  patterns: DetectedChartPattern[]
) {
  if (highs.length < 2) return;

  const first = highs[highs.length - 2];
  const second = highs[highs.length - 1];

  if (second.index - first.index < 4) return;

  const highsClose = percentDifference(first.price, second.price) <= 0.025;
  const between = candles.slice(first.index, second.index + 1);

  if (!between.length) return;

  const neckline = Math.min(...between.map((candle) => candle.low));
  const latest = candles[candles.length - 1];

  const rejected = latest.close <= second.price * 0.99;
  const necklineBreak = latest.close <= neckline * 1.002;

  if (!highsClose || !rejected) return;

  let confidence = 62;
  const reasons = ["近い価格帯で2回上昇に失敗"];

  if (necklineBreak) {
    confidence += 18;
    reasons.push("ネックラインを下抜け");
  }

  if (volumeRatio >= 1.3) {
    confidence += 8;
    reasons.push("出来高増加");
  }

  pushPattern(patterns, {
    id: "pattern020",
    name: "ダブルトップ反落",
    direction: "SELL",
    confidence,
    score: -25,
    reasons,
  });
}

function detectHeadAndShoulders(
  candles: PatternCandle[],
  highs: Pivot[],
  volumeRatio: number,
  patterns: DetectedChartPattern[]
) {
  if (highs.length < 3) return;

  const [left, head, right] = highs.slice(-3);

  const headAboveShoulders =
    head.price > left.price * 1.015 &&
    head.price > right.price * 1.015;

  const shouldersClose =
    percentDifference(left.price, right.price) <= 0.05;

  if (!headAboveShoulders || !shouldersClose) return;

  const leftToHead = candles.slice(left.index, head.index + 1);
  const headToRight = candles.slice(head.index, right.index + 1);

  if (!leftToHead.length || !headToRight.length) return;

  const necklineLeft = Math.min(...leftToHead.map((candle) => candle.low));
  const necklineRight = Math.min(...headToRight.map((candle) => candle.low));
  const neckline = average([necklineLeft, necklineRight]);

  const latest = candles[candles.length - 1];
  const breakdown = latest.close <= neckline * 1.002;

  let confidence = 65;
  const reasons = ["中央の高値が左右の高値より高い"];

  if (breakdown) {
    confidence += 20;
    reasons.push("ネックラインを下抜け");
  }

  if (volumeRatio >= 1.3) {
    confidence += 7;
    reasons.push("出来高増加");
  }

  pushPattern(patterns, {
    id: "pattern021",
    name: "三尊天井",
    direction: "SELL",
    confidence,
    score: -30,
    reasons,
  });
}

function detectInverseHeadAndShoulders(
  candles: PatternCandle[],
  lows: Pivot[],
  volumeRatio: number,
  patterns: DetectedChartPattern[]
) {
  if (lows.length < 3) return;

  const [left, head, right] = lows.slice(-3);

  const headBelowShoulders =
    head.price < left.price * 0.985 &&
    head.price < right.price * 0.985;

  const shouldersClose =
    percentDifference(left.price, right.price) <= 0.05;

  if (!headBelowShoulders || !shouldersClose) return;

  const leftToHead = candles.slice(left.index, head.index + 1);
  const headToRight = candles.slice(head.index, right.index + 1);

  if (!leftToHead.length || !headToRight.length) return;

  const necklineLeft = Math.max(...leftToHead.map((candle) => candle.high));
  const necklineRight = Math.max(...headToRight.map((candle) => candle.high));
  const neckline = average([necklineLeft, necklineRight]);

  const latest = candles[candles.length - 1];
  const breakout = latest.close >= neckline * 0.998;

  let confidence = 67;
  const reasons = ["中央の安値が左右の安値より深い"];

  if (breakout) {
    confidence += 20;
    reasons.push("ネックラインを上抜け");
  }

  if (volumeRatio >= 1.3) {
    confidence += 7;
    reasons.push("出来高増加");
  }

  pushPattern(patterns, {
    id: "pattern022",
    name: "逆三尊",
    direction: "BUY",
    confidence,
    score: 34,
    reasons,
  });
}

function detectRangeBreakout(
  candles: PatternCandle[],
  volumeRatio: number,
  patterns: DetectedChartPattern[]
) {
  if (candles.length < 21) return;

  const previous = candles.slice(-21, -1);
  const latest = candles[candles.length - 1];

  const resistance = Math.max(...previous.map((candle) => candle.high));
  const support = Math.min(...previous.map((candle) => candle.low));
  const rangeRate = (resistance - support) / Math.max(support, 0.0001);

  const breakout = latest.close > resistance * 1.002;

  if (!breakout || rangeRate > 0.18) return;

  let confidence = 64;
  const reasons = ["直近レンジの上限を突破"];

  if (volumeRatio >= 1.5) {
    confidence += 15;
    reasons.push("出来高を伴った上抜け");
  }

  pushPattern(patterns, {
    id: "pattern003",
    name: "レンジ上抜けブレイク",
    direction: "BUY",
    confidence,
    score: 21,
    reasons,
  });
}

function detectHighBreakout(
  candles: PatternCandle[],
  volumeRatio: number,
  patterns: DetectedChartPattern[]
) {
  if (candles.length < 61) return;

  const previous = candles.slice(-61, -1);
  const latest = candles[candles.length - 1];

  const previousHigh = Math.max(...previous.map((candle) => candle.high));

  if (latest.close <= previousHigh * 1.002) return;

  let confidence = 68;
  const reasons = ["直近60本の高値を更新"];

  if (volumeRatio >= 1.5) {
    confidence += 14;
    reasons.push("出来高増加");
  }

  pushPattern(patterns, {
    id: "pattern018",
    name: "高値更新ブレイク",
    direction: "BUY",
    confidence,
    score: 24,
    reasons,
  });
}

function detectSupportBreakdown(
  candles: PatternCandle[],
  volumeRatio: number,
  patterns: DetectedChartPattern[]
) {
  if (candles.length < 21) return;

  const previous = candles.slice(-21, -1);
  const latest = candles[candles.length - 1];

  const support = Math.min(...previous.map((candle) => candle.low));

  if (latest.close >= support * 0.998) return;

  let confidence = 66;
  const reasons = ["直近支持帯を下抜け"];

  if (volumeRatio >= 1.5) {
    confidence += 14;
    reasons.push("出来高を伴った下落");
  }

  pushPattern(patterns, {
    id: "pattern030",
    name: "サポート割れ",
    direction: "SELL",
    confidence,
    score: -25,
    reasons,
  });
}

function detectEmaCrosses(
  candles: PatternCandle[],
  patterns: DetectedChartPattern[]
) {
  if (candles.length < 77) return;

  const closes = candles.map((candle) => candle.close);
  const ema20 = calculateEmaSeries(closes, 20);
  const ema75 = calculateEmaSeries(closes, 75);

  const currentIndex = candles.length - 1;
  const previousIndex = candles.length - 2;

  const currentFast = ema20[currentIndex];
  const previousFast = ema20[previousIndex];
  const currentSlow = ema75[currentIndex];
  const previousSlow = ema75[previousIndex];

  if (
    currentFast === null ||
    previousFast === null ||
    currentSlow === null ||
    previousSlow === null
  ) {
    return;
  }

  if (previousFast <= previousSlow && currentFast > currentSlow) {
    pushPattern(patterns, {
      id: "pattern014",
      name: "ゴールデンクロス初動",
      direction: "BUY",
      confidence: 76,
      score: 23,
      reasons: ["EMA20がEMA75を上抜け"],
    });
  }

  if (previousFast >= previousSlow && currentFast < currentSlow) {
    pushPattern(patterns, {
      id: "pattern029",
      name: "デッドクロス",
      direction: "SELL",
      confidence: 76,
      score: -23,
      reasons: ["EMA20がEMA75を下抜け"],
    });
  }
}

function detectLowerWick(
  candles: PatternCandle[],
  volumeRatio: number,
  patterns: DetectedChartPattern[]
) {
  if (!candles.length) return;

  const latest = candles[candles.length - 1];

  const body = Math.max(Math.abs(latest.close - latest.open), 0.0001);
  const lowerWick = Math.min(latest.open, latest.close) - latest.low;
  const upperWick = latest.high - Math.max(latest.open, latest.close);

  const strongLowerWick =
    lowerWick >= body * 2 &&
    lowerWick > upperWick * 1.3 &&
    latest.close > latest.low;

  if (!strongLowerWick) return;

  let confidence = 65;
  const reasons = ["実体の2倍以上の下ヒゲ"];

  if (latest.close >= latest.open) {
    confidence += 8;
    reasons.push("陽線で終了");
  }

  if (volumeRatio >= 1.3) {
    confidence += 7;
    reasons.push("出来高増加");
  }

  pushPattern(patterns, {
    id: "pattern006",
    name: "下ヒゲ反発",
    direction: "BUY",
    confidence,
    score: 18,
    reasons,
  });
}

export function detectChartPatterns(
  rawCandles: PatternCandle[]
): DetectedChartPattern[] {
  const candles = rawCandles
    .filter(
      (candle) =>
        Number.isFinite(candle.open) &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close)
    )
    .slice(-150);

  if (candles.length < 5) return [];

  const patterns: DetectedChartPattern[] = [];
  const volumeRatio = getVolumeRatio(candles);
  const { highs, lows } = detectPivots(candles);

  detectDoubleBottom(candles, lows, volumeRatio, patterns);
  detectDoubleTop(candles, highs, volumeRatio, patterns);
  detectHeadAndShoulders(candles, highs, volumeRatio, patterns);
  detectInverseHeadAndShoulders(candles, lows, volumeRatio, patterns);
  detectRangeBreakout(candles, volumeRatio, patterns);
  detectHighBreakout(candles, volumeRatio, patterns);
  detectSupportBreakdown(candles, volumeRatio, patterns);
  detectEmaCrosses(candles, patterns);
  detectLowerWick(candles, volumeRatio, patterns);

  return patterns.sort((a, b) => b.confidence - a.confidence);
}
