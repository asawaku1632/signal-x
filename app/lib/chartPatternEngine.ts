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


type RegressionLine = {
  slope: number;
  intercept: number;
  startValue: number;
  endValue: number;
};

function calculateRegressionLine(values: number[]): RegressionLine | null {
  if (values.length < 2) return null;

  const xAverage = (values.length - 1) / 2;
  const yAverage = average(values);

  let numerator = 0;
  let denominator = 0;

  for (let index = 0; index < values.length; index++) {
    const xDifference = index - xAverage;
    numerator += xDifference * (values[index] - yAverage);
    denominator += xDifference * xDifference;
  }

  if (denominator === 0) return null;

  const slope = numerator / denominator;
  const intercept = yAverage - slope * xAverage;

  return {
    slope,
    intercept,
    startValue: intercept,
    endValue: intercept + slope * (values.length - 1),
  };
}

function getNormalizedSlope(line: RegressionLine) {
  const base = Math.max(Math.abs(line.startValue), 0.0001);
  return (line.endValue - line.startValue) / base;
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
  if (lows.length < 2 || candles.length === 0) return;

  const latest = candles[candles.length - 1];
  const recentLows = lows.slice(-6);

  for (
    let secondIndex = recentLows.length - 1;
    secondIndex >= 1;
    secondIndex--
  ) {
    const second = recentLows[secondIndex];

    for (let firstIndex = secondIndex - 1; firstIndex >= 0; firstIndex--) {
      const first = recentLows[firstIndex];
      const distance = second.index - first.index;

      // 底同士が近すぎる場合や、古すぎる組み合わせは除外する。
      if (distance < 4 || distance > 60) continue;

      const lowsClose =
        percentDifference(first.price, second.price) <= 0.035;

      if (!lowsClose) continue;

      const between = candles.slice(first.index, second.index + 1);
      if (!between.length) continue;

      const neckline = Math.max(
        ...between.map((candle) => candle.high)
      );
      const bounced = latest.close >= second.price * 1.01;

      if (!bounced) continue;

      const necklineBreak = latest.close >= neckline * 0.998;

      let confidence = 62;
      const reasons = ["近い価格帯で2回下げ止まり"];

      if (necklineBreak) {
        confidence += 18;
        reasons.push("ネックラインを上抜け");
      } else if (latest.close >= neckline * 0.97) {
        confidence += 8;
        reasons.push("ネックライン付近まで回復");
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

      return;
    }
  }
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


function detectTrianglePatterns(
  candles: PatternCandle[],
  volumeRatio: number,
  patterns: DetectedChartPattern[]
) {
  const lookback = 30;
  if (candles.length < lookback) return;

  const recent = candles.slice(-lookback);
  const highs = recent.map((candle) => candle.high);
  const lows = recent.map((candle) => candle.low);
  const highLine = calculateRegressionLine(highs);
  const lowLine = calculateRegressionLine(lows);

  if (!highLine || !lowLine) return;

  const highSlope = getNormalizedSlope(highLine);
  const lowSlope = getNormalizedSlope(lowLine);
  const initialWidth = highLine.startValue - lowLine.startValue;
  const finalWidth = highLine.endValue - lowLine.endValue;

  if (initialWidth <= 0 || finalWidth <= 0) return;

  const contractionRate = finalWidth / initialWidth;
  const latest = recent[recent.length - 1];
  const latestRange = Math.max(latest.high - latest.low, 0.0001);
  const latestPosition = (latest.close - latest.low) / latestRange;
  const isContracting = contractionRate <= 0.78;

  if (!isContracting) return;

  const flatTolerance = 0.018;
  const trendThreshold = 0.025;

  const upperIsFlat = Math.abs(highSlope) <= flatTolerance;
  const lowerIsFlat = Math.abs(lowSlope) <= flatTolerance;
  const lowerIsRising = lowSlope >= trendThreshold;
  const upperIsFalling = highSlope <= -trendThreshold;

  if (upperIsFlat && lowerIsRising) {
    let confidence = 66;
    const reasons = ["上値抵抗がほぼ横ばい", "安値が切り上がり", "値幅が収縮"];

    if (latest.close >= highLine.endValue * 0.995 || latestPosition >= 0.7) {
      confidence += 8;
      reasons.push("終値が上限付近");
    }

    if (latest.close > highLine.endValue * 1.002) {
      confidence += 10;
      reasons.push("上値抵抗を突破");
    }

    if (volumeRatio >= 1.3) {
      confidence += 6;
      reasons.push("出来高増加");
    }

    pushPattern(patterns, {
      id: "pattern031",
      name: "上昇三角持ち合い",
      direction: "BUY",
      confidence,
      score: 24,
      reasons,
    });
  }

  if (lowerIsFlat && upperIsFalling) {
    let confidence = 66;
    const reasons = ["下値支持がほぼ横ばい", "高値が切り下がり", "値幅が収縮"];

    if (latest.close <= lowLine.endValue * 1.005 || latestPosition <= 0.3) {
      confidence += 8;
      reasons.push("終値が下限付近");
    }

    if (latest.close < lowLine.endValue * 0.998) {
      confidence += 10;
      reasons.push("下値支持を割り込み");
    }

    if (volumeRatio >= 1.3) {
      confidence += 6;
      reasons.push("出来高増加");
    }

    pushPattern(patterns, {
      id: "pattern032",
      name: "下降三角持ち合い",
      direction: "SELL",
      confidence,
      score: -24,
      reasons,
    });
  }

  if (upperIsFalling && lowerIsRising) {
    let confidence = 64;
    const reasons = ["高値が切り下がり", "安値が切り上がり", "値幅が収縮"];
    let direction: PatternDirection = "NEUTRAL";
    let score = 0;

    if (latest.close > highLine.endValue * 1.002) {
      direction = "BUY";
      score = 22;
      confidence += 14;
      reasons.push("上方へブレイク");
    } else if (latest.close < lowLine.endValue * 0.998) {
      direction = "SELL";
      score = -22;
      confidence += 14;
      reasons.push("下方へブレイク");
    } else {
      reasons.push("方向確定前");
    }

    if (volumeRatio >= 1.3 && direction !== "NEUTRAL") {
      confidence += 6;
      reasons.push("出来高増加");
    }

    pushPattern(patterns, {
      id: "pattern033",
      name: "対称三角持ち合い",
      direction,
      confidence,
      score,
      reasons,
    });
  }
}


function detectFlagPatterns(
  candles: PatternCandle[],
  volumeRatio: number,
  patterns: DetectedChartPattern[]
) {
  const poleLength = 12;
  const flagLength = 10;
  const requiredLength = poleLength + flagLength;

  if (candles.length < requiredLength + 2) return;

  const recent = candles.slice(-requiredLength);
  const pole = recent.slice(0, poleLength);
  const flag = recent.slice(poleLength);

  const poleStart = pole[0];
  const poleEnd = pole[pole.length - 1];
  const latest = flag[flag.length - 1];

  const poleMove =
    (poleEnd.close - poleStart.close) / Math.max(poleStart.close, 0.0001);
  const poleCloses = calculateRegressionLine(pole.map((candle) => candle.close));
  const flagCloses = calculateRegressionLine(flag.map((candle) => candle.close));
  const flagHighs = calculateRegressionLine(flag.map((candle) => candle.high));
  const flagLows = calculateRegressionLine(flag.map((candle) => candle.low));

  if (!poleCloses || !flagCloses || !flagHighs || !flagLows) return;

  const poleSlope = getNormalizedSlope(poleCloses);
  const flagCloseSlope = getNormalizedSlope(flagCloses);
  const flagHighSlope = getNormalizedSlope(flagHighs);
  const flagLowSlope = getNormalizedSlope(flagLows);
  const flagLinesAreParallel =
    Math.abs(flagHighSlope - flagLowSlope) <= 0.025;

  const flagHighest = Math.max(...flag.map((candle) => candle.high));
  const flagLowest = Math.min(...flag.map((candle) => candle.low));
  const flagRange = flagHighest - flagLowest;
  const absolutePoleMove = Math.abs(poleEnd.close - poleStart.close);
  const compactFlag =
    absolutePoleMove > 0 && flagRange <= absolutePoleMove * 0.75;

  if (!flagLinesAreParallel || !compactFlag) return;

  const bullishPole = poleMove >= 0.06 && poleSlope >= 0.045;
  const bearishPole = poleMove <= -0.06 && poleSlope <= -0.045;

  if (bullishPole) {
    const orderlyPullback =
      flagCloseSlope <= -0.003 &&
      flagCloseSlope >= -0.055 &&
      flagHighSlope < 0 &&
      flagLowSlope < 0;

    const retracement =
      (poleEnd.close - flagLowest) / Math.max(absolutePoleMove, 0.0001);

    if (orderlyPullback && retracement <= 0.55) {
      let confidence = 67;
      const reasons = [
        "上昇ポール形成",
        "高値・安値が緩やかに切り下がる平行調整",
        "調整幅がポールに対して限定的",
      ];

      if (latest.close >= flagHighs.endValue * 0.998) {
        confidence += 7;
        reasons.push("終値がフラッグ上限付近");
      }

      if (latest.close > flagHighs.endValue * 1.002) {
        confidence += 11;
        reasons.push("フラッグ上限を上抜け");
      }

      if (volumeRatio >= 1.3) {
        confidence += 6;
        reasons.push("出来高増加");
      }

      pushPattern(patterns, {
        id: "pattern034",
        name: "上昇フラッグ",
        direction: "BUY",
        confidence,
        score: 26,
        reasons,
      });
    }
  }

  if (bearishPole) {
    const orderlyRebound =
      flagCloseSlope >= 0.003 &&
      flagCloseSlope <= 0.055 &&
      flagHighSlope > 0 &&
      flagLowSlope > 0;

    const retracement =
      (flagHighest - poleEnd.close) / Math.max(absolutePoleMove, 0.0001);

    if (orderlyRebound && retracement <= 0.55) {
      let confidence = 67;
      const reasons = [
        "下降ポール形成",
        "高値・安値が緩やかに切り上がる平行調整",
        "戻り幅がポールに対して限定的",
      ];

      if (latest.close <= flagLows.endValue * 1.002) {
        confidence += 7;
        reasons.push("終値がフラッグ下限付近");
      }

      if (latest.close < flagLows.endValue * 0.998) {
        confidence += 11;
        reasons.push("フラッグ下限を下抜け");
      }

      if (volumeRatio >= 1.3) {
        confidence += 6;
        reasons.push("出来高増加");
      }

      pushPattern(patterns, {
        id: "pattern035",
        name: "下降フラッグ",
        direction: "SELL",
        confidence,
        score: -26,
        reasons,
      });
    }
  }
}


function detectBoxPatterns(
  candles: PatternCandle[],
  volumeRatio: number,
  patterns: DetectedChartPattern[]
) {
  // 最新足を判定足として分離し、その直前30本で水平な支持線・抵抗線を探す。
  if (candles.length < 31) return;

  const boxCandles = candles.slice(-31, -1);
  const latest = candles[candles.length - 1];

  const highs = boxCandles.map((candle) => candle.high);
  const lows = boxCandles.map((candle) => candle.low);
  const closes = boxCandles.map((candle) => candle.close);

  const highLine = calculateRegressionLine(highs);
  const lowLine = calculateRegressionLine(lows);

  if (!highLine || !lowLine) return;

  const resistance = Math.max(...highs);
  const support = Math.min(...lows);
  const middle = (resistance + support) / 2;
  const rangeRate =
    (resistance - support) / Math.max(Math.abs(middle), 0.0001);

  // 狭すぎる値幅はノイズ、広すぎる値幅は通常の乱高下として除外する。
  if (rangeRate < 0.025 || rangeRate > 0.16) return;

  const highSlope = Math.abs(getNormalizedSlope(highLine));
  const lowSlope = Math.abs(getNormalizedSlope(lowLine));
  const horizontalBoundaries = highSlope <= 0.025 && lowSlope <= 0.025;

  if (!horizontalBoundaries) return;

  const touchTolerance = Math.max(rangeRate * 0.16, 0.008);
  const resistanceTouches = highs.filter(
    (high) => (resistance - high) / Math.max(resistance, 0.0001) <= touchTolerance
  ).length;
  const supportTouches = lows.filter(
    (low) => (low - support) / Math.max(support, 0.0001) <= touchTolerance
  ).length;

  // 上下それぞれ複数回止められていることをボックス成立条件とする。
  if (resistanceTouches < 2 || supportTouches < 2) return;

  const containedCloses = closes.filter(
    (close) => close <= resistance * 1.003 && close >= support * 0.997
  ).length;
  const containmentRate = containedCloses / closes.length;

  if (containmentRate < 0.9) return;

  const upwardBreakout = latest.close > resistance * 1.002;
  const downwardBreakout = latest.close < support * 0.998;

  if (upwardBreakout) {
    let confidence = 72;
    const reasons = [
      "水平な抵抗線と支持線でボックスを形成",
      "ボックス上限を終値で上抜け",
    ];

    if (latest.open <= resistance * 1.006) {
      confidence += 5;
      reasons.push("上限付近から素直にブレイク");
    }

    if (volumeRatio >= 1.3) {
      confidence += 9;
      reasons.push("出来高増加を伴う上抜け");
    }

    pushPattern(patterns, {
      id: "pattern037",
      name: "ボックス上抜け",
      direction: "BUY",
      confidence,
      score: 27,
      reasons,
    });

    return;
  }

  if (downwardBreakout) {
    let confidence = 72;
    const reasons = [
      "水平な抵抗線と支持線でボックスを形成",
      "ボックス下限を終値で下抜け",
    ];

    if (latest.open >= support * 0.994) {
      confidence += 5;
      reasons.push("下限付近から素直にブレイク");
    }

    if (volumeRatio >= 1.3) {
      confidence += 9;
      reasons.push("出来高増加を伴う下抜け");
    }

    pushPattern(patterns, {
      id: "pattern038",
      name: "ボックス下抜け",
      direction: "SELL",
      confidence,
      score: -27,
      reasons,
    });

    return;
  }

  const latestInsideBox =
    latest.close <= resistance * 1.002 && latest.close >= support * 0.998;

  if (!latestInsideBox) return;

  let confidence = 66;
  const reasons = [
    "水平な抵抗線と支持線を複数回確認",
    "終値の大半が一定価格帯に収まる",
  ];

  if (containmentRate >= 0.97) {
    confidence += 6;
    reasons.push("価格の収まりが非常に安定");
  }

  if (resistanceTouches >= 3 && supportTouches >= 3) {
    confidence += 6;
    reasons.push("上下の境界をそれぞれ3回以上確認");
  }

  pushPattern(patterns, {
    id: "pattern036",
    name: "ボックス相場",
    direction: "NEUTRAL",
    confidence,
    score: 8,
    reasons,
  });
}


function detectCupWithHandle(
  candles: PatternCandle[],
  volumeRatio: number,
  patterns: DetectedChartPattern[]
) {
  // カップ部分45本 + ハンドル部分8〜14本を目安に判定する。
  if (candles.length < 55) return;

  const handleLength = Math.min(12, Math.max(8, Math.floor(candles.length * 0.08)));
  const cupLength = 48;
  const requiredLength = cupLength + handleLength;
  if (candles.length < requiredLength) return;

  const recent = candles.slice(-requiredLength);
  const cup = recent.slice(0, cupLength);
  const handle = recent.slice(cupLength);
  const latest = handle[handle.length - 1];

  const edgeLength = Math.max(7, Math.floor(cupLength * 0.2));
  const leftZone = cup.slice(0, edgeLength);
  const rightZone = cup.slice(-edgeLength);
  const middleZone = cup.slice(edgeLength, -edgeLength);

  const leftRim = Math.max(...leftZone.map((candle) => candle.high));
  const rightRim = Math.max(...rightZone.map((candle) => candle.high));
  const rimAverage = (leftRim + rightRim) / 2;
  const bottom = Math.min(...middleZone.map((candle) => candle.low));

  if (rimAverage <= 0 || bottom <= 0) return;

  const rimDifference = percentDifference(leftRim, rightRim);
  const cupDepth = (rimAverage - bottom) / rimAverage;

  // 左右のリムが近く、深さ8〜35%のカップだけを対象にする。
  if (rimDifference > 0.055 || cupDepth < 0.08 || cupDepth > 0.35) return;

  const quarterLength = Math.floor(cupLength / 4);
  const firstQuarter = average(
    cup.slice(0, quarterLength).map((candle) => candle.close)
  );
  const secondQuarter = average(
    cup.slice(quarterLength, quarterLength * 2).map((candle) => candle.close)
  );
  const thirdQuarter = average(
    cup.slice(quarterLength * 2, quarterLength * 3).map((candle) => candle.close)
  );
  const fourthQuarter = average(
    cup.slice(quarterLength * 3).map((candle) => candle.close)
  );

  const roundedCup =
    firstQuarter > secondQuarter &&
    fourthQuarter > thirdQuarter &&
    average([secondQuarter, thirdQuarter]) < average([firstQuarter, fourthQuarter]);

  if (!roundedCup) return;

  const handleHigh = Math.max(...handle.map((candle) => candle.high));
  const handleLow = Math.min(...handle.map((candle) => candle.low));
  const handleDepth = (rightRim - handleLow) / Math.max(rightRim, 0.0001);
  const handleLine = calculateRegressionLine(
    handle.map((candle) => candle.close)
  );

  if (!handleLine) return;

  const handleSlope = getNormalizedSlope(handleLine);
  const shallowHandle = handleDepth >= 0.015 && handleDepth <= Math.min(0.15, cupDepth * 0.55);
  const orderlyHandle = handleSlope >= -0.07 && handleSlope <= 0.025;
  const staysNearRim = handleHigh >= rightRim * 0.985;

  if (!shallowHandle || !orderlyHandle || !staysNearRim) return;

  let confidence = 72;
  const reasons = [
    "左右のリムが近いカップ形状",
    "中央に丸みのある底を形成",
    "右リム後に浅いハンドルを形成",
  ];

  if (rimDifference <= 0.03) {
    confidence += 6;
    reasons.push("左右リムの高さが高精度で一致");
  }

  if (cupDepth >= 0.12 && cupDepth <= 0.25) {
    confidence += 5;
    reasons.push("カップの深さが適正範囲");
  }

  if (latest.close >= rimAverage * 0.995) {
    confidence += 6;
    reasons.push("終値がリム付近まで回復");
  }

  if (latest.close > Math.max(leftRim, rightRim) * 1.002) {
    confidence += 8;
    reasons.push("リムを終値で上抜け");
  }

  if (volumeRatio >= 1.3) {
    confidence += 5;
    reasons.push("出来高増加");
  }

  pushPattern(patterns, {
    id: "pattern039",
    name: "カップウィズハンドル",
    direction: "BUY",
    confidence,
    score: 32,
    reasons,
  });
}

function detectWedgePatterns(
  candles: PatternCandle[],
  patterns: DetectedChartPattern[]
) {
  const lookback = 30;
  if (candles.length < lookback + 1) return;

  // 最新足はブレイク判定に使い、その直前の値動きでウェッジを判定する。
  const wedge = candles.slice(-lookback - 1, -1);
  const latest = candles[candles.length - 1];
  const highLine = calculateRegressionLine(wedge.map((candle) => candle.high));
  const lowLine = calculateRegressionLine(wedge.map((candle) => candle.low));

  if (!highLine || !lowLine) return;

  const highSlope = getNormalizedSlope(highLine);
  const lowSlope = getNormalizedSlope(lowLine);
  const initialWidth = highLine.startValue - lowLine.startValue;
  const finalWidth = highLine.endValue - lowLine.endValue;

  if (initialWidth <= 0 || finalWidth <= 0) return;

  const contractionRate = finalWidth / initialWidth;
  if (contractionRate > 0.78) return;

  const risingWedge =
    highSlope >= 0.018 &&
    lowSlope >= 0.028 &&
    lowSlope > highSlope * 1.2;
  const fallingWedge =
    highSlope <= -0.028 &&
    lowSlope <= -0.018 &&
    Math.abs(highSlope) > Math.abs(lowSlope) * 1.2;

  if (risingWedge) {
    let confidence = 70;
    const reasons = [
      "高値と安値がともに切り上がり",
      "安値側が高値側より速く上昇",
      "値幅が徐々に収縮",
    ];

    if (latest.close < lowLine.endValue * 0.998) {
      confidence += 16;
      reasons.push("ウェッジ下限を終値で下抜け");
    }

    pushPattern(patterns, {
      id: "pattern040",
      name: "上昇ウェッジ",
      direction: "SELL",
      confidence,
      score: -28,
      reasons,
    });
  } else if (fallingWedge) {
    let confidence = 70;
    const reasons = [
      "高値と安値がともに切り下がり",
      "高値側が安値側より速く下落",
      "値幅が徐々に収縮",
    ];

    if (latest.close > highLine.endValue * 1.002) {
      confidence += 16;
      reasons.push("ウェッジ上限を終値で突破");
    }

    pushPattern(patterns, {
      id: "pattern041",
      name: "下降ウェッジ",
      direction: "BUY",
      confidence,
      score: 28,
      reasons,
    });
  }
}

function detectPennant(
  candles: PatternCandle[],
  volumeRatio: number,
  patterns: DetectedChartPattern[]
) {
  const poleLength = 12;
  const pennantLength = 10;
  const requiredLength = poleLength + pennantLength;
  if (candles.length < requiredLength) return;

  const recent = candles.slice(-requiredLength);
  const pole = recent.slice(0, poleLength);
  const pennant = recent.slice(poleLength);
  const poleStart = pole[0];
  const poleEnd = pole[pole.length - 1];
  const latest = pennant[pennant.length - 1];
  const poleMove =
    (poleEnd.close - poleStart.close) / Math.max(Math.abs(poleStart.close), 0.0001);
  const highLine = calculateRegressionLine(pennant.map((candle) => candle.high));
  const lowLine = calculateRegressionLine(pennant.map((candle) => candle.low));

  if (!highLine || !lowLine) return;

  const highSlope = getNormalizedSlope(highLine);
  const lowSlope = getNormalizedSlope(lowLine);
  const initialWidth = highLine.startValue - lowLine.startValue;
  const finalWidth = highLine.endValue - lowLine.endValue;
  const poleSize = Math.abs(poleEnd.close - poleStart.close);
  const pennantRange =
    Math.max(...pennant.map((candle) => candle.high)) -
    Math.min(...pennant.map((candle) => candle.low));

  const triangularConsolidation =
    highSlope <= -0.012 &&
    lowSlope >= 0.012 &&
    initialWidth > 0 &&
    finalWidth > 0 &&
    finalWidth / initialWidth <= 0.72 &&
    poleSize > 0 &&
    pennantRange <= poleSize * 0.7;

  if (!triangularConsolidation) return;

  // poleMoveは単一値なので上昇・下降ペナントが同時成立しない。
  const direction: PatternDirection =
    poleMove >= 0.06 ? "BUY" : poleMove <= -0.06 ? "SELL" : "NEUTRAL";
  if (direction === "NEUTRAL") return;

  let confidence = 72;
  const reasons = [
    direction === "BUY" ? "急上昇のポールを形成" : "急下降のポールを形成",
    "ポール後に高値切り下げ・安値切り上げ",
    "短期間で値幅が収縮",
  ];
  const breakout =
    direction === "BUY"
      ? latest.close > highLine.endValue * 1.002
      : latest.close < lowLine.endValue * 0.998;

  if (breakout) {
    confidence += 10;
    reasons.push(direction === "BUY" ? "上限を上抜け" : "下限を下抜け");
  }

  if (breakout && volumeRatio >= 1.3) {
    confidence += 8;
    reasons.push("出来高増加を伴うブレイク");
  }

  pushPattern(patterns, {
    id: "pattern042",
    name: direction === "BUY" ? "上昇ペナント" : "下降ペナント",
    direction,
    confidence,
    score: direction === "BUY" ? 29 : -29,
    reasons,
  });
}

function detectVolumeBreakouts(
  candles: PatternCandle[],
  volumeRatio: number,
  patterns: DetectedChartPattern[]
) {
  if (candles.length < 21 || volumeRatio < 1.8) return;

  const previous = candles.slice(-21, -1);
  const latest = candles[candles.length - 1];
  const resistance = Math.max(...previous.map((candle) => candle.high));
  const support = Math.min(...previous.map((candle) => candle.low));
  const body = Math.abs(latest.close - latest.open);
  const recentAverageBody = average(
    previous.map((candle) => Math.abs(candle.close - candle.open))
  );
  const largeBody = body >= Math.max(recentAverageBody * 1.5, 0.0001);

  if (latest.close > resistance * 1.002) {
    let confidence = 74;
    const reasons = ["最新出来高が直近平均の1.8倍以上", "直近高値を終値で上抜け"];

    if (latest.close > latest.open && largeBody) {
      confidence += 8;
      reasons.push("実体の大きい陽線");
    }
    if (volumeRatio >= 3) {
      confidence += 8;
      reasons.push("出来高が直近平均の3倍以上に急増");
    }

    pushPattern(patterns, {
      id: "pattern043",
      name: "出来高急増ブレイク",
      direction: "BUY",
      confidence,
      score: 30,
      reasons,
    });
  } else if (latest.close < support * 0.998) {
    let confidence = 74;
    const reasons = ["最新出来高が直近平均の1.8倍以上", "直近安値を終値で下抜け"];

    if (latest.close < latest.open && largeBody) {
      confidence += 8;
      reasons.push("実体の大きい陰線");
    }
    if (volumeRatio >= 3) {
      confidence += 8;
      reasons.push("出来高が直近平均の3倍以上に急増");
    }

    pushPattern(patterns, {
      id: "pattern044",
      name: "出来高急増下抜け",
      direction: "SELL",
      confidence,
      score: -30,
      reasons,
    });
  }
}

function standardDeviation(values: number[], mean: number) {
  if (!values.length) return 0;
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      values.length
  );
}

function detectBollingerSqueeze(
  candles: PatternCandle[],
  volumeRatio: number,
  patterns: DetectedChartPattern[]
) {
  const period = 20;
  const historyLength = 60;
  if (candles.length < historyLength + 1) return;

  const closes = candles.map((candle) => candle.close);
  const historicalWidths: number[] = [];

  // 最新足を除いた過去の20期間バンド幅を比較対象にする。
  for (let end = closes.length - historyLength; end < closes.length; end++) {
    if (end < period) continue;
    const window = closes.slice(end - period, end);
    const mean = average(window);
    if (mean <= 0) continue;
    historicalWidths.push((standardDeviation(window, mean) * 4) / mean);
  }

  if (historicalWidths.length < 20) return;

  const referenceWindow = closes.slice(-period - 1, -1);
  const middle = average(referenceWindow);
  const deviation = standardDeviation(referenceWindow, middle);
  if (middle <= 0 || deviation <= 0) return;

  const currentWidth = (deviation * 4) / middle;
  const sortedWidths = [...historicalWidths].sort((a, b) => a - b);
  const lowWidthThreshold = sortedWidths[Math.floor(sortedWidths.length * 0.25)];
  if (currentWidth > lowWidthThreshold) return;

  const upperBand = middle + deviation * 2;
  const lowerBand = middle - deviation * 2;
  const latest = candles[candles.length - 1];
  let direction: PatternDirection = "NEUTRAL";
  let score = 0;
  let confidence = 68;
  const reasons = ["20期間ボリンジャーバンド幅が過去の低水準"];

  if (latest.close > upperBand) {
    direction = "BUY";
    score = 27;
    confidence += 12;
    reasons.push("上側バンドを終値で突破");
  } else if (latest.close < lowerBand) {
    direction = "SELL";
    score = -27;
    confidence += 12;
    reasons.push("下側バンドを終値で割り込み");
  } else {
    reasons.push("スクイーズ継続中");
  }

  if (direction !== "NEUTRAL" && volumeRatio >= 1.3) {
    confidence += 8;
    reasons.push("出来高増加を伴うバンドブレイク");
  }

  pushPattern(patterns, {
    id: "pattern045",
    name: "ボリンジャーバンドスクイーズ",
    direction,
    confidence,
    score,
    reasons,
  });
}

function detectPerfectOrders(
  candles: PatternCandle[],
  patterns: DetectedChartPattern[]
) {
  if (candles.length < 78) return;

  const closes = candles.map((candle) => candle.close);
  const ema5 = calculateEmaSeries(closes, 5);
  const ema20 = calculateEmaSeries(closes, 20);
  const ema75 = calculateEmaSeries(closes, 75);
  const current = candles.length - 1;
  const comparison = current - 3;
  const current5 = ema5[current];
  const current20 = ema20[current];
  const current75 = ema75[current];
  const previous5 = ema5[comparison];
  const previous20 = ema20[comparison];
  const previous75 = ema75[comparison];

  if (
    current5 === null ||
    current20 === null ||
    current75 === null ||
    previous5 === null ||
    previous20 === null ||
    previous75 === null
  ) {
    return;
  }

  const bullish =
    current5 > current20 &&
    current20 > current75 &&
    current5 > previous5 &&
    current20 > previous20 &&
    current75 > previous75;
  const bearish =
    current5 < current20 &&
    current20 < current75 &&
    current5 < previous5 &&
    current20 < previous20 &&
    current75 < previous75;

  if (bullish) {
    pushPattern(patterns, {
      id: "pattern046",
      name: "上昇パーフェクトオーダー",
      direction: "BUY",
      confidence: 78,
      score: 26,
      reasons: ["EMA5 > EMA20 > EMA75", "3本のEMAがすべて上向き"],
    });
  } else if (bearish) {
    pushPattern(patterns, {
      id: "pattern047",
      name: "下降パーフェクトオーダー",
      direction: "SELL",
      confidence: 78,
      score: -26,
      reasons: ["EMA5 < EMA20 < EMA75", "3本のEMAがすべて下向き"],
    });
  }
}

function optimizeDetectedPatterns(
  rawPatterns: DetectedChartPattern[]
): DetectedChartPattern[] {
  // 同一IDの重複を除去し、よりconfidenceが高い判定だけを残す。
  const uniqueById = new Map<string, DetectedChartPattern>();

  for (const pattern of rawPatterns) {
    const normalized: DetectedChartPattern = {
      ...pattern,
      confidence: Math.round(clamp(pattern.confidence, 45, 96)),
      score: Math.round(clamp(pattern.score, -40, 40)),
      reasons: [...new Set(pattern.reasons)],
    };

    const existing = uniqueById.get(pattern.id);
    if (!existing || normalized.confidence > existing.confidence) {
      uniqueById.set(pattern.id, normalized);
    }
  }

  let patterns = [...uniqueById.values()];
  const buyPatterns = patterns.filter((pattern) => pattern.direction === "BUY");
  const sellPatterns = patterns.filter((pattern) => pattern.direction === "SELL");

  const directionalPower = (items: DetectedChartPattern[]) =>
    items.reduce(
      (sum, pattern) =>
        sum + Math.abs(pattern.score) * (pattern.confidence / 100),
      0
    );

  const buyPower = directionalPower(buyPatterns);
  const sellPower = directionalPower(sellPatterns);

  // BUYとSELLが競合した場合は、総合パワーが強い方向を採用する。
  if (buyPatterns.length > 0 && sellPatterns.length > 0) {
    const dominantDirection: PatternDirection =
      buyPower >= sellPower ? "BUY" : "SELL";
    const dominantPower = Math.max(buyPower, sellPower);
    const opposingPower = Math.min(buyPower, sellPower);
    const conflictRatio = opposingPower / Math.max(dominantPower, 0.0001);
    const confidencePenalty = Math.round(clamp(conflictRatio * 18, 4, 18));
    const scorePenalty = Math.round(clamp(conflictRatio * 6, 1, 6));

    patterns = patterns
      .filter(
        (pattern) =>
          pattern.direction === dominantDirection ||
          pattern.direction === "NEUTRAL"
      )
      .map((pattern) => {
        if (pattern.direction !== dominantDirection) return pattern;

        return {
          ...pattern,
          confidence: Math.round(
            clamp(pattern.confidence - confidencePenalty, 45, 96)
          ),
          score:
            dominantDirection === "BUY"
              ? Math.round(clamp(pattern.score - scorePenalty, 1, 40))
              : Math.round(clamp(pattern.score + scorePenalty, -40, -1)),
          reasons: [
            ...pattern.reasons,
            `反対方向のシグナルと競合したため信頼度を${confidencePenalty}ポイント調整`,
          ],
        };
      });
  }

  // 同方向のパターンが複数一致した場合はconfidenceとPattern Scoreを加算する。
  for (const direction of ["BUY", "SELL"] as const) {
    const sameDirection = patterns.filter(
      (pattern) => pattern.direction === direction
    );

    if (sameDirection.length < 2) continue;

    const confidenceBonus = Math.min(16, (sameDirection.length - 1) * 4);
    const scoreBonus = Math.min(8, (sameDirection.length - 1) * 2);

    patterns = patterns.map((pattern) => {
      if (pattern.direction !== direction) return pattern;

      return {
        ...pattern,
        confidence: Math.round(
          clamp(pattern.confidence + confidenceBonus, 45, 96)
        ),
        score:
          direction === "BUY"
            ? Math.round(clamp(pattern.score + scoreBonus, 1, 40))
            : Math.round(clamp(pattern.score - scoreBonus, -40, -1)),
        reasons: [
          ...pattern.reasons,
          `同方向の${sameDirection.length}パターン一致で信頼度を補強`,
        ],
      };
    });
  }

  return patterns.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return Math.abs(b.score) - Math.abs(a.score);
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
  detectTrianglePatterns(candles, volumeRatio, patterns);
  detectFlagPatterns(candles, volumeRatio, patterns);
  detectBoxPatterns(candles, volumeRatio, patterns);
  detectCupWithHandle(candles, volumeRatio, patterns);
  detectWedgePatterns(candles, patterns);
  detectPennant(candles, volumeRatio, patterns);
  detectVolumeBreakouts(candles, volumeRatio, patterns);
  detectBollingerSqueeze(candles, volumeRatio, patterns);
  detectPerfectOrders(candles, patterns);
  detectRangeBreakout(candles, volumeRatio, patterns);
  detectHighBreakout(candles, volumeRatio, patterns);
  detectSupportBreakdown(candles, volumeRatio, patterns);
  detectEmaCrosses(candles, patterns);
  detectLowerWick(candles, volumeRatio, patterns);

  return optimizeDetectedPatterns(patterns);
}
