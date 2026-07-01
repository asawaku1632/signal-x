import { NextResponse } from "next/server";
import { ACTIVE_STOCKS } from "@/app/lib/activeStockList";

export const dynamic = "force-dynamic";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function calculateMA(values: number[], period: number) {
  if (values.length < period) return null;

  const target = values.slice(-period);
  const sum = target.reduce((total, value) => total + value, 0);

  return Number((sum / period).toFixed(2));
}

function calculateBollingerBands(values: number[], period = 20, multiplier = 2) {
  if (values.length < period) {
    return {
      bbUpper: null,
      bbMiddle: null,
      bbLower: null,
    };
  }

  const target = values.slice(-period);
  const mean = target.reduce((sum, value) => sum + value, 0) / period;

  const variance =
    target.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / period;

  const stdDev = Math.sqrt(variance);

  return {
    bbUpper: Number((mean + multiplier * stdDev).toFixed(2)),
    bbMiddle: Number(mean.toFixed(2)),
    bbLower: Number((mean - multiplier * stdDev).toFixed(2)),
  };
}

function calculateEMA(values: number[], period: number) {
  if (values.length < period) return null;

  const k = 2 / (period + 1);

  let ema =
    values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }

  return Number(ema.toFixed(2));
}

function calculateEMAList(values: number[], period: number) {
  if (values.length < period) return [];

  const k = 2 / (period + 1);
  const result: number[] = [];

  let ema =
    values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  result.push(ema);

  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result.push(ema);
  }

  return result;
}

function calculateRSI(values: number[], period = 14) {
  if (values.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];

    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return Number(rsi.toFixed(2));
}

function calculateMACD(values: number[]) {
  if (values.length < 35) {
    return {
      macd: null,
      macdSignal: null,
      macdHistogram: null,
    };
  }

  const ema12List = calculateEMAList(values, 12);
  const ema26List = calculateEMAList(values, 26);

  const offset = ema12List.length - ema26List.length;

  const macdLine = ema26List.map((ema26, index) => {
    return ema12List[index + offset] - ema26;
  });

  const signalList = calculateEMAList(macdLine, 9);

  if (signalList.length === 0) {
    return {
      macd: null,
      macdSignal: null,
      macdHistogram: null,
    };
  }

  const macd = macdLine[macdLine.length - 1];
  const macdSignal = signalList[signalList.length - 1];
  const macdHistogram = macd - macdSignal;

  return {
    macd: Number(macd.toFixed(2)),
    macdSignal: Number(macdSignal.toFixed(2)),
    macdHistogram: Number(macdHistogram.toFixed(2)),
  };
}

function calculateVWAP(candles: Candle[]) {
  if (candles.length === 0) return null;

  let totalPV = 0;
  let totalVolume = 0;

  for (const candle of candles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const volume = candle.volume ?? 0;

    totalPV += typicalPrice * volume;
    totalVolume += volume;
  }

  if (totalVolume === 0) return null;

  return Number((totalPV / totalVolume).toFixed(2));
}

function calculateTechnicalValues(candles: Candle[]) {
  const closes = candles.map((candle) => candle.close);
  const macd = calculateMACD(closes);
  const bollinger = calculateBollingerBands(closes, 20, 2);

  return {
    ma5: calculateMA(closes, 5),
    ma20: calculateMA(closes, 20),
    ma60: calculateMA(closes, 60),
    ema20: calculateEMA(closes, 20),
    rsi14: calculateRSI(closes, 14),
    vwap: calculateVWAP(candles),
    ...macd,
    ...bollinger,
  };
}

async function fetchYahooCandles(code: string) {
  const symbol = `${code}.T`;

  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=1d&interval=5m`,
    {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    }
  );

  if (!res.ok) return [];

  const data = await res.json();
  const result = data.chart?.result?.[0];

  if (!result) return [];

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];

  if (!quote) return [];

  return timestamps
    .map((time: number, index: number) => ({
      time,
      open: quote.open?.[index],
      high: quote.high?.[index],
      low: quote.low?.[index],
      close: quote.close?.[index],
      volume: quote.volume?.[index],
    }))
    .filter((item: any) => item.close);
}

function calcDiff(a: number | null, b: number | null) {
  return a !== null && b !== null
    ? Number(Math.abs(a - b).toFixed(4))
    : null;
}

export async function GET(req: Request) {
  const startedAt = Date.now();

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") || 10);

  const targetStocks = ACTIVE_STOCKS.slice(0, limit);
  const results = [];

  for (const stock of targetStocks) {
    const candles: Candle[] = await fetchYahooCandles(stock.code);

    const yahoo = calculateTechnicalValues(candles);
    const signalx = calculateTechnicalValues(candles);

    const diff5 = calcDiff(yahoo.ma5, signalx.ma5);
    const diff20 = calcDiff(yahoo.ma20, signalx.ma20);
    const diff60 = calcDiff(yahoo.ma60, signalx.ma60);
    const diffEma20 = calcDiff(yahoo.ema20, signalx.ema20);
    const diffRsi14 = calcDiff(yahoo.rsi14, signalx.rsi14);
    const diffVwap = calcDiff(yahoo.vwap, signalx.vwap);
    const diffMacd = calcDiff(yahoo.macd, signalx.macd);
    const diffMacdSignal = calcDiff(yahoo.macdSignal, signalx.macdSignal);
    const diffMacdHistogram = calcDiff(
      yahoo.macdHistogram,
      signalx.macdHistogram
    );
    const diffBbUpper = calcDiff(yahoo.bbUpper, signalx.bbUpper);
    const diffBbMiddle = calcDiff(yahoo.bbMiddle, signalx.bbMiddle);
    const diffBbLower = calcDiff(yahoo.bbLower, signalx.bbLower);

    const status =
      diff5 !== null &&
      diff20 !== null &&
      diff60 !== null &&
      diffEma20 !== null &&
      diffRsi14 !== null &&
      diffVwap !== null &&
      diffMacd !== null &&
      diffMacdSignal !== null &&
      diffMacdHistogram !== null &&
      diffBbUpper !== null &&
      diffBbMiddle !== null &&
      diffBbLower !== null &&
      diff5 <= 0.01 &&
      diff20 <= 0.01 &&
      diff60 <= 0.01 &&
      diffEma20 <= 0.01 &&
      diffRsi14 <= 0.01 &&
      diffVwap <= 0.01 &&
      diffMacd <= 0.01 &&
      diffMacdSignal <= 0.01 &&
      diffMacdHistogram <= 0.01 &&
      diffBbUpper <= 0.01 &&
      diffBbMiddle <= 0.01 &&
      diffBbLower <= 0.01
        ? "PASS"
        : "FAIL";

    results.push({
      code: stock.code,
      name: stock.name,
      candleCount: candles.length,

      yahoo,
      signalx,

      diff5,
      diff20,
      diff60,
      diffEma20,
      diffRsi14,
      diffVwap,
      diffMacd,
      diffMacdSignal,
      diffMacdHistogram,
      diffBbUpper,
      diffBbMiddle,
      diffBbLower,

      status,
    });
  }

  const passCount = results.filter((item) => item.status === "PASS").length;
  const failCount = results.filter((item) => item.status === "FAIL").length;

  return NextResponse.json({
    success: true,
    checkedAt: new Date().toISOString(),
    targetCount: targetStocks.length,
    passCount,
    failCount,
    matchRate: targetStocks.length
      ? Number(((passCount / targetStocks.length) * 100).toFixed(2))
      : 0,
    indicators: [
      "MA5",
      "MA20",
      "MA60",
      "EMA20",
      "RSI14",
      "VWAP",
      "MACD",
      "MACD_SIGNAL",
      "MACD_HISTOGRAM",
      "BB_UPPER",
      "BB_MIDDLE",
      "BB_LOWER",
    ],
    results,
    scanMs: Date.now() - startedAt,
  });
}