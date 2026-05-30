import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

const STOCKS = [
  { code: "9983", symbol: "9983.T", name: "ファストリ" },
  { code: "8035", symbol: "8035.T", name: "東京エレクトロン" },
  { code: "7203", symbol: "7203.T", name: "トヨタ" },
  { code: "6758", symbol: "6758.T", name: "ソニー" },
  { code: "8306", symbol: "8306.T", name: "三菱UFJ" },
  { code: "9984", symbol: "9984.T", name: "ソフトバンクG" },
];

function calculateRSI(closes: number[], period = 14) {
  if (closes.length <= period) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];

    if (diff > 0) gains += diff;
    if (diff < 0) losses += Math.abs(diff);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return Number(rsi.toFixed(1));
}

async function getRealRSI(symbol: string) {
  try {
    const history = await yahooFinance.historical(symbol, {
      period1: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40),
      period2: new Date(),
      interval: "1d",
    });

    const closes = history
      .map((item: any) => Number(item.close))
      .filter((price) => Number.isFinite(price) && price > 0);

    return calculateRSI(closes, 14);
  } catch (error) {
    console.error("RSI取得エラー:", symbol, error);
    return 50;
  }
}

function detectPatterns(
  price: number,
  previousClose: number,
  volumeRatio: number,
  rsi: number
) {
  const patterns = {
    bullishEngulfing: false,
    rapidRise: false,
    rapidDrop: false,
    rebound: false,
    lowerWickBounce: false,
    upperWickWarning: false,
    volumeBreakout: false,
    highBreak: false,
    goldenCross: false,
    deadCross: false,
    trendFollow: false,
  };

  const changePercent =
    previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0;

  if (rsi >= 55 && changePercent >= 1.5) patterns.bullishEngulfing = true;
  if (changePercent >= 3) patterns.rapidRise = true;
  if (changePercent <= -3) patterns.rapidDrop = true;
  if (rsi >= 45 && rsi <= 60 && changePercent > 0) patterns.rebound = true;
  if (rsi <= 45 && changePercent > 0.5) patterns.lowerWickBounce = true;
  if (rsi >= 70 && changePercent < 0.5) patterns.upperWickWarning = true;
  if (volumeRatio >= 2) patterns.volumeBreakout = true;
  if (changePercent >= 4) patterns.highBreak = true;
  if (rsi >= 60 && volumeRatio >= 1.2) patterns.goldenCross = true;
  if (rsi <= 35 && changePercent < 0) patterns.deadCross = true;

  if (rsi >= 55 && changePercent >= 1 && volumeRatio >= 1) {
    patterns.trendFollow = true;
  }

  return patterns;
}

function calculateScore(
  rsi: number,
  volumeRatio: number,
  changePercent: number,
  patterns: ReturnType<typeof detectPatterns>
) {
  let score = 50;

  score += Math.min(rsi - 50, 20);
  score += Math.min(volumeRatio * 5, 15);
  score += Math.min(changePercent * 3, 20);

  if (patterns.bullishEngulfing) score += 10;
  if (patterns.rapidRise) score += 12;
  if (patterns.rebound) score += 8;
  if (patterns.lowerWickBounce) score += 10;
  if (patterns.volumeBreakout) score += 10;
  if (patterns.highBreak) score += 12;
  if (patterns.goldenCross) score += 10;
  if (patterns.trendFollow) score += 10;

  if (patterns.upperWickWarning) score -= 8;
  if (patterns.deadCross) score -= 15;
  if (patterns.rapidDrop) score -= 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function generateReason(patterns: ReturnType<typeof detectPatterns>) {
  const reasons: string[] = [];

  if (patterns.bullishEngulfing) reasons.push("包み線");
  if (patterns.rapidRise) reasons.push("急騰");
  if (patterns.rebound) reasons.push("反発");
  if (patterns.lowerWickBounce) reasons.push("下ヒゲ反発");
  if (patterns.volumeBreakout) reasons.push("出来高急増");
  if (patterns.highBreak) reasons.push("高値更新");
  if (patterns.goldenCross) reasons.push("GC接近");
  if (patterns.trendFollow) reasons.push("トレンド継続");
  if (patterns.upperWickWarning) reasons.push("上ヒゲ警戒");
  if (patterns.deadCross) reasons.push("DC警戒");
  if (patterns.rapidDrop) reasons.push("急落警戒");

  return reasons.length === 0 ? "目立つシグナルなし" : reasons.join(" / ");
}

export async function GET() {
  try {
    const stocks = await Promise.all(
      STOCKS.map(async (stock) => {
        const quote: any = await yahooFinance.quote(stock.symbol);

        const price = Number(quote.regularMarketPrice || 0);
        const previousClose = Number(quote.regularMarketPreviousClose || price);
        const volume = Number(quote.regularMarketVolume || 0);
        const avgVolume = Number(quote.averageDailyVolume3Month || volume || 1);

        const volumeRatio = Number((volume / avgVolume).toFixed(2));

        const changePercent =
          previousClose > 0
            ? Number((((price - previousClose) / previousClose) * 100).toFixed(2))
            : 0;

        const rsi = await getRealRSI(stock.symbol);

        const patterns = detectPatterns(price, previousClose, volumeRatio, rsi);
        const score = calculateScore(rsi, volumeRatio, changePercent, patterns);
        const reason = generateReason(patterns);

        return {
          code: stock.code,
          name: stock.name,
          price,
          rsi,
          score,
          volumeRatio,
          changePercent,
          reason,
          patterns,
        };
      })
    );

    stocks.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      success: true,
      stocks,
      signals: stocks,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        stocks: [],
        signals: [],
      },
      { status: 500 }
    );
  }
}