import type { Stock } from "@/app/lib/stockList";
import {
  calculateAiScore,
  type ChartAnalysis,
} from "@/app/lib/aiEngine";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type SupportResistanceStatus =
  | "BREAKOUT"
  | "NEAR_RESISTANCE"
  | "NEAR_SUPPORT"
  | "BETWEEN_LEVELS"
  | "BREAKDOWN_RISK"
  | "NO_DATA";

export type YahooChartAnalysis = ChartAnalysis & {
  dataSource?: string;
  supportPrice?: number | null;
  resistancePrice?: number | null;
  supportDistancePercent?: number | null;
  resistanceDistancePercent?: number | null;
  supportResistanceStatus?: SupportResistanceStatus;
  breakoutExpectation?: number;
};

type ChartData = {
  candles: Candle[];
  closes: number[];
  currentPrice: number;
};

type PriceLevel = {
  price: number;
  touches: number;
  latestTime: number;
};

function roundPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(2));
}

function roundPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(2));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeCandles(rawCandles: any[]): Candle[] {
  return rawCandles
    .filter(
      (item) =>
        Number.isFinite(item.time) &&
        Number.isFinite(item.open) &&
        Number.isFinite(item.high) &&
        Number.isFinite(item.low) &&
        Number.isFinite(item.close)
    )
    .map((item) => ({
      time: Number(item.time),
      open: Number(item.open),
      high: Number(item.high),
      low: Number(item.low),
      close: Number(item.close),
      volume: Number.isFinite(item.volume) ? Number(item.volume) : 0,
    }));
}

function detectPivotLevels(candles: Candle[]) {
  const pivotHighs: { price: number; time: number }[] = [];
  const pivotLows: { price: number; time: number }[] = [];
  const windowSize = 2;

  for (let index = windowSize; index < candles.length - windowSize; index++) {
    const current = candles[index];
    const window = candles.slice(index - windowSize, index + windowSize + 1);

    const highest = Math.max(...window.map((candle) => candle.high));
    const lowest = Math.min(...window.map((candle) => candle.low));

    if (current.high >= highest) {
      pivotHighs.push({
        price: current.high,
        time: current.time,
      });
    }

    if (current.low <= lowest) {
      pivotLows.push({
        price: current.low,
        time: current.time,
      });
    }
  }

  return {
    pivotHighs,
    pivotLows,
  };
}

function clusterPriceLevels(
  points: { price: number; time: number }[],
  currentPrice: number
): PriceLevel[] {
  if (points.length === 0 || currentPrice <= 0) return [];

  const toleranceRate = 0.012;
  const sorted = [...points].sort((a, b) => a.price - b.price);
  const clusters: { prices: number[]; times: number[] }[] = [];

  for (const point of sorted) {
    const existing = clusters.find((cluster) => {
      const center = average(cluster.prices);
      return Math.abs(point.price - center) / currentPrice <= toleranceRate;
    });

    if (existing) {
      existing.prices.push(point.price);
      existing.times.push(point.time);
    } else {
      clusters.push({
        prices: [point.price],
        times: [point.time],
      });
    }
  }

  return clusters
    .map((cluster) => ({
      price: average(cluster.prices),
      touches: cluster.prices.length,
      latestTime: Math.max(...cluster.times),
    }))
    .sort((a, b) => {
      if (b.touches !== a.touches) return b.touches - a.touches;
      return b.latestTime - a.latestTime;
    });
}

function selectSupport(
  levels: PriceLevel[],
  currentPrice: number,
  fallbackLow: number | null
) {
  const candidates = levels
    .filter((level) => level.price < currentPrice * 0.999)
    .sort((a, b) => {
      const distanceA = currentPrice - a.price;
      const distanceB = currentPrice - b.price;

      const scoreA =
        a.touches * 4 - (distanceA / currentPrice) * 100 + a.latestTime / 1e12;
      const scoreB =
        b.touches * 4 - (distanceB / currentPrice) * 100 + b.latestTime / 1e12;

      return scoreB - scoreA;
    });

  return candidates[0]?.price ?? fallbackLow;
}

function selectResistance(
  levels: PriceLevel[],
  currentPrice: number,
  fallbackHigh: number | null
) {
  const candidates = levels
    .filter((level) => level.price > currentPrice * 1.001)
    .sort((a, b) => {
      const distanceA = a.price - currentPrice;
      const distanceB = b.price - currentPrice;

      const scoreA =
        a.touches * 4 - (distanceA / currentPrice) * 100 + a.latestTime / 1e12;
      const scoreB =
        b.touches * 4 - (distanceB / currentPrice) * 100 + b.latestTime / 1e12;

      return scoreB - scoreA;
    });

  return candidates[0]?.price ?? fallbackHigh;
}

function calculateBreakoutExpectation({
  currentPrice,
  resistancePrice,
  candles,
  trend,
}: {
  currentPrice: number;
  resistancePrice: number | null;
  candles: Candle[];
  trend: string;
}) {
  if (!resistancePrice || candles.length < 2 || currentPrice <= 0) return 0;

  const recent = candles.slice(-20);
  const latest = recent[recent.length - 1];
  const previous = recent[recent.length - 2];

  const averageVolume = average(
    recent.slice(0, -1).map((candle) => candle.volume).filter((value) => value > 0)
  );

  const volumeRatio =
    averageVolume > 0 && latest.volume > 0 ? latest.volume / averageVolume : 1;

  const distanceToResistance =
    ((resistancePrice - currentPrice) / currentPrice) * 100;

  const latestRange = Math.max(latest.high - latest.low, 0.01);
  const closePosition = (latest.close - latest.low) / latestRange;
  const positiveMomentum =
    previous?.close > 0
      ? ((latest.close - previous.close) / previous.close) * 100
      : 0;

  let score = 35;

  if (trend === "UPTREND") score += 20;
  if (distanceToResistance <= 1) score += 20;
  else if (distanceToResistance <= 3) score += 12;
  else if (distanceToResistance <= 5) score += 5;

  if (volumeRatio >= 2) score += 15;
  else if (volumeRatio >= 1.3) score += 8;

  if (closePosition >= 0.8) score += 8;
  else if (closePosition <= 0.35) score -= 8;

  if (positiveMomentum >= 2) score += 10;
  else if (positiveMomentum < 0) score -= 10;

  return Math.round(clamp(score, 0, 99));
}

function analyzeSupportResistance(
  candles: Candle[],
  currentPrice: number,
  trend: string
) {
  if (candles.length < 5 || currentPrice <= 0) {
    return {
      supportPrice: null,
      resistancePrice: null,
      supportDistancePercent: null,
      resistanceDistancePercent: null,
      supportResistanceStatus: "NO_DATA" as SupportResistanceStatus,
      breakoutExpectation: 0,
    };
  }

  const recent = candles.slice(-60);
  const { pivotHighs, pivotLows } = detectPivotLevels(recent);

  const supportLevels = clusterPriceLevels(pivotLows, currentPrice);
  const resistanceLevels = clusterPriceLevels(pivotHighs, currentPrice);

  const fallbackLow =
    recent.length > 0
      ? Math.min(...recent.slice(-20).map((candle) => candle.low))
      : null;

  const fallbackHigh =
    recent.length > 0
      ? Math.max(...recent.slice(-20).map((candle) => candle.high))
      : null;

  const supportPrice = selectSupport(
    supportLevels,
    currentPrice,
    fallbackLow !== null && fallbackLow < currentPrice ? fallbackLow : null
  );

  const resistancePrice = selectResistance(
    resistanceLevels,
    currentPrice,
    fallbackHigh !== null && fallbackHigh > currentPrice ? fallbackHigh : null
  );

  const supportDistancePercent =
    supportPrice && supportPrice > 0
      ? ((currentPrice - supportPrice) / currentPrice) * 100
      : null;

  const resistanceDistancePercent =
    resistancePrice && resistancePrice > 0
      ? ((resistancePrice - currentPrice) / currentPrice) * 100
      : null;

  let supportResistanceStatus: SupportResistanceStatus = "BETWEEN_LEVELS";

  if (
    resistancePrice &&
    currentPrice >= resistancePrice * 1.002
  ) {
    supportResistanceStatus = "BREAKOUT";
  } else if (
    supportPrice &&
    currentPrice <= supportPrice * 0.998
  ) {
    supportResistanceStatus = "BREAKDOWN_RISK";
  } else if (
    resistanceDistancePercent !== null &&
    resistanceDistancePercent >= 0 &&
    resistanceDistancePercent <= 1.5
  ) {
    supportResistanceStatus = "NEAR_RESISTANCE";
  } else if (
    supportDistancePercent !== null &&
    supportDistancePercent >= 0 &&
    supportDistancePercent <= 1.5
  ) {
    supportResistanceStatus = "NEAR_SUPPORT";
  }

  const breakoutExpectation = calculateBreakoutExpectation({
    currentPrice,
    resistancePrice,
    candles: recent,
    trend,
  });

  return {
    supportPrice: roundPrice(supportPrice),
    resistancePrice: roundPrice(resistancePrice),
    supportDistancePercent: roundPercent(supportDistancePercent),
    resistanceDistancePercent: roundPercent(resistanceDistancePercent),
    supportResistanceStatus,
    breakoutExpectation,
  };
}

export async function fetchYahooChart(
  code: string
): Promise<YahooChartAnalysis | null> {
  const symbol = `${code}.T`;

  async function fetchChart(
    range: string,
    interval: string,
    sliceLimit: number
  ): Promise<ChartData | null> {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?range=${range}&interval=${interval}`,
      {
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const result = data.chart?.result?.[0];

    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0];

    const rawCandles = timestamps
      .map((time: number, index: number) => ({
        time,
        open: quote?.open?.[index],
        high: quote?.high?.[index],
        low: quote?.low?.[index],
        close: quote?.close?.[index],
        volume: quote?.volume?.[index],
      }))
      .filter((item: any) => item.close !== null && item.close !== undefined)
      .slice(-sliceLimit);

    const candles = normalizeCandles(rawCandles);
    const closes = candles.map((candle) => candle.close);
    const currentPrice = closes[closes.length - 1] ?? null;

    if (!currentPrice) return null;

    return {
      candles,
      closes,
      currentPrice,
    };
  }

  const intradayChart = await fetchChart("1d", "5m", 60);
  const dailyChart = await fetchChart("3mo", "1d", 90);

  let chartData = intradayChart;
  let dataSource = "intraday";

  if (!chartData) {
    chartData = dailyChart;
    dataSource = "daily_fallback";
  }

  if (!chartData) return null;

  const { candles, closes, currentPrice } = chartData;
  const levelCandles =
    dailyChart?.candles && dailyChart.candles.length >= 20
      ? dailyChart.candles
      : candles;

  const ma20 =
    closes.length >= 20
      ? closes.slice(-20).reduce((sum: number, value: number) => {
          return sum + value;
        }, 0) / 20
      : dailyChart?.closes && dailyChart.closes.length >= 20
        ? dailyChart.closes
            .slice(-20)
            .reduce((sum: number, value: number) => sum + value, 0) / 20
        : null;

  const trend =
    ma20 === null || currentPrice === null
      ? "NO_DATA"
      : currentPrice > ma20
        ? "UPTREND"
        : "DOWNTREND";

  const prev = candles[candles.length - 2];
  const last = candles[candles.length - 1];

  let candleSignal = "NONE";
  let patternSignal = "NONE";
  let patternScore = 0;
  const patternReasons: string[] = [];

  if (prev && last) {
    const prevBear = prev.close < prev.open;
    const prevBull = prev.close > prev.open;
    const lastBear = last.close < last.open;
    const lastBull = last.close > last.open;

    const bullishEngulfing =
      prevBear &&
      lastBull &&
      last.open <= prev.close &&
      last.close >= prev.open;

    const bearishEngulfing =
      prevBull &&
      lastBear &&
      last.open >= prev.close &&
      last.close <= prev.open;

    if (bullishEngulfing) {
      candleSignal = "BULLISH_ENGULFING";
      patternScore += 15;
      patternReasons.push("買い包み足を検出");
    }

    if (bearishEngulfing) {
      candleSignal = "BEARISH_ENGULFING";
      patternScore -= 15;
      patternReasons.push("売り包み足を検出");
    }
  }

  if (trend === "UPTREND") {
    patternScore += 10;
    patternReasons.push("現在価格がMA20より上");
  }

  if (trend === "DOWNTREND") {
    patternScore -= 10;
    patternReasons.push("現在価格がMA20より下");
  }

  if (candles.length >= 20 && currentPrice !== null) {
    const recent = candles.slice(-20);
    const firstHalf = recent.slice(0, 10);
    const secondHalf = recent.slice(10, 20);

    const firstLow = Math.min(...firstHalf.map((candle) => candle.low));
    const secondLow = Math.min(...secondHalf.map((candle) => candle.low));

    const firstLowIndex = firstHalf.findIndex(
      (candle) => candle.low === firstLow
    );
    const secondLowIndex =
      secondHalf.findIndex((candle) => candle.low === secondLow) + 10;

    const lowsClose = Math.abs(firstLow - secondLow) / currentPrice < 0.015;

    const middleRange = recent.slice(firstLowIndex, secondLowIndex);
    const middleHigh =
      middleRange.length > 0
        ? Math.max(...middleRange.map((candle) => candle.high))
        : currentPrice;

    const necklineBreak = currentPrice > middleHigh * 0.998;
    const bouncedFromSecondLow = currentPrice > secondLow * 1.008;

    if (lowsClose && bouncedFromSecondLow) {
      patternSignal = "W_BOTTOM";
      patternScore += 25;
      patternReasons.push("Wボトム候補を検出");
    }

    if (lowsClose && bouncedFromSecondLow && necklineBreak) {
      patternSignal = "W_BOTTOM_BREAK";
      patternScore += 20;
      patternReasons.push("ネックライン付近まで回復");
    }
  }

  const supportResistance = analyzeSupportResistance(
    levelCandles,
    currentPrice,
    trend
  );

  if (supportResistance.supportResistanceStatus === "BREAKOUT") {
    patternScore += 15;
    patternReasons.push("抵抗線ブレイクを検出");
  }

  if (supportResistance.supportResistanceStatus === "NEAR_SUPPORT") {
    patternScore += 5;
    patternReasons.push("支持線付近で推移");
  }

  if (supportResistance.supportResistanceStatus === "NEAR_RESISTANCE") {
    patternReasons.push("抵抗線付近のため上値に注意");
  }

  if (supportResistance.supportResistanceStatus === "BREAKDOWN_RISK") {
    patternScore -= 15;
    patternReasons.push("支持線割れリスクを検出");
  }

  return {
    success: true,
    dataSource,
    currentPrice,
    ma20: ma20 === null ? null : Number(ma20.toFixed(2)),
    trend,
    candleSignal,
    patternSignal,
    patternScore,
    patternReasons,
    candles,
    ...supportResistance,
  };
}

export async function analyzeStock(stock: Stock) {
  const chart = await fetchYahooChart(stock.code);

  if (!chart?.currentPrice) return null;

  const scored = calculateAiScore({
    code: stock.code,
    name: stock.name,
    price: chart.currentPrice,
    previousClose: chart.candles?.[0]?.open ?? null,
    chart,
  });

  return {
    ...scored,
    dataSource: chart.dataSource ?? "intraday",
    supportPrice: chart.supportPrice ?? null,
    resistancePrice: chart.resistancePrice ?? null,
    supportDistancePercent: chart.supportDistancePercent ?? null,
    resistanceDistancePercent: chart.resistanceDistancePercent ?? null,
    supportResistanceStatus:
      chart.supportResistanceStatus ?? "NO_DATA",
    breakoutExpectation: chart.breakoutExpectation ?? 0,
  };
}