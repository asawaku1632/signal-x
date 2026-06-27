import { NextResponse } from "next/server";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

function calculateEma(values: number[], period: number) {
  if (values.length < period) return null;

  const multiplier = 2 / (period + 1);

  let ema =
    values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
  }

  return Number(ema.toFixed(2));
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

function calculateVwap(candles: Candle[]) {
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

function calculateMacd(closes: number[]) {
  if (closes.length < 35) {
    return {
      macd: null,
      macdSignal: null,
      macdHistogram: null,
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
      macdSignal: null,
      macdHistogram: null,
    };
  }

  return {
    macd: Number(macd.toFixed(2)),
    macdSignal: Number(signal.toFixed(2)),
    macdHistogram: Number((macd - signal).toFixed(2)),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawSymbol = url.pathname.split("/").pop() || "";

  const isJapanStock = /^[0-9]{4}$/.test(rawSymbol);
  const symbol = isJapanStock ? `${rawSymbol}.T` : rawSymbol;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?range=1d&interval=5m`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
        cache: "no-store",
      }
    );

    const data = await res.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      return NextResponse.json({
        success: false,
        symbol,
        count: 0,
        currentPrice: null,
        ma20: null,
        ema20: null,
        ema75: null,
        vwap: null,
        macd: null,
        macdSignal: null,
        macdHistogram: null,
        trend: "NO_DATA",
        candleSignal: "NO_DATA",
        patternSignal: "NO_DATA",
        patternScore: 0,
        patternReasons: [],
        candles: [],
      });
    }

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];

    const candles: Candle[] = timestamps
      .map((time: number, index: number) => ({
        time,
        open: quote?.open?.[index],
        high: quote?.high?.[index],
        low: quote?.low?.[index],
        close: quote?.close?.[index],
        volume: quote?.volume?.[index],
      }))
      .filter((item: any) => item.close)
      .slice(-60);

    const closes = candles.map((candle) => candle.close);
    const currentPrice = closes[closes.length - 1] ?? null;

    const ma20 =
      closes.length >= 20
        ? closes.slice(-20).reduce((sum, value) => sum + value, 0) / 20
        : null;

    const ema20 = calculateEma(closes, 20);
    const ema75 = calculateEma(closes, 75);
    const vwap = calculateVwap(candles);
    const macdData = calculateMacd(closes);

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

      const lowsClose =
        Math.abs(firstLow - secondLow) / currentPrice < 0.015;

      const middleHigh = Math.max(
        ...recent
          .slice(firstLowIndex, secondLowIndex)
          .map((candle) => candle.high)
      );

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

    return NextResponse.json({
      success: true,
      symbol,
      count: candles.length,
      currentPrice,
      ma20: ma20 === null ? null : Number(ma20.toFixed(2)),
      ema20,
      ema75,
      vwap,
      macd: macdData.macd,
      macdSignal: macdData.macdSignal,
      macdHistogram: macdData.macdHistogram,
      trend,
      candleSignal,
      patternSignal,
      patternScore,
      patternReasons,
      candles,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      symbol,
      count: 0,
      currentPrice: null,
      ma20: null,
      ema20: null,
      ema75: null,
      vwap: null,
      macd: null,
      macdSignal: null,
      macdHistogram: null,
      trend: "ERROR",
      candleSignal: "ERROR",
      patternSignal: "ERROR",
      patternScore: 0,
      patternReasons: [],
      candles: [],
    });
  }
}