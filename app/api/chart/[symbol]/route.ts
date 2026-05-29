import { NextResponse } from "next/server";

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

    const candles = timestamps
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

    const closes = candles.map((c: any) => c.close);
    const currentPrice = closes[closes.length - 1] ?? null;

    const ma20 =
      closes.length >= 20
        ? closes
            .slice(-20)
            .reduce((sum: number, value: number) => {
              return sum + value;
            }, 0) / 20
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

    // Wボトム強化版
    if (candles.length >= 20 && currentPrice !== null) {
      const recent = candles.slice(-20);

      const firstHalf = recent.slice(0, 10);
      const secondHalf = recent.slice(10, 20);

      const firstLow = Math.min(...firstHalf.map((c: any) => c.low));
      const secondLow = Math.min(...secondHalf.map((c: any) => c.low));

      const firstLowIndex = firstHalf.findIndex(
        (c: any) => c.low === firstLow
      );

      const secondLowIndex =
        secondHalf.findIndex((c: any) => c.low === secondLow) + 10;

      const lowsClose =
        Math.abs(firstLow - secondLow) / currentPrice < 0.015;

      const middleHigh = Math.max(
        ...recent
          .slice(firstLowIndex, secondLowIndex)
          .map((c: any) => c.high)
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
      trend: "ERROR",
      candleSignal: "ERROR",
      patternSignal: "ERROR",
      patternScore: 0,
      patternReasons: [],
      candles: [],
    });
  }
}