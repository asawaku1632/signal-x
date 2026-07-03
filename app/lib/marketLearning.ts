import pool from "@/app/lib/postgres";

type StockResult = {
  code: string;
  name?: string;
  result?: string;
  aiPower?: number;
  score?: number;
  changePercent?: number;
};

type MarketDataInput = {
  tradeDate: string;
  stocks: StockResult[];
  nikkei?: number | null;
  topix?: number | null;
  usdJpy?: number | null;
  vix?: number | null;
};

export type MarketLearningSummary = {
  tradeDate: string;
  nikkei: number | null;
  topix: number | null;
  usdJpy: number | null;
  vix: number | null;
  marketTrend: string;
  marketScore: number;
  marketPattern: string;
  marketComment: string;
  totalCount: number;
  winCount: number;
  loseCount: number;
  holdCount: number;
  judgedCount: number;
  winRate: number;
  aiBonus: number;
  confidence: number;
};

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));

  if (valid.length === 0) return 0;

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function calculateMarketScore(stocks: StockResult[]) {
  const aiPowerAverage = average(
    stocks
      .map((stock) => stock.aiPower ?? stock.score)
      .filter((value): value is number => typeof value === "number")
  );

  const changeAverage = average(
    stocks
      .map((stock) => stock.changePercent)
      .filter((value): value is number => typeof value === "number")
  );

  let score = 50;

  if (aiPowerAverage >= 70) score += 20;
  else if (aiPowerAverage >= 60) score += 12;
  else if (aiPowerAverage >= 50) score += 6;
  else if (aiPowerAverage < 35) score -= 15;
  else if (aiPowerAverage < 45) score -= 8;

  if (changeAverage >= 2) score += 18;
  else if (changeAverage >= 1) score += 10;
  else if (changeAverage >= 0.3) score += 5;
  else if (changeAverage <= -2) score -= 18;
  else if (changeAverage <= -1) score -= 10;
  else if (changeAverage <= -0.3) score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getMarketTrend(score: number) {
  if (score >= 85) return "SUPER_BULLISH";
  if (score >= 70) return "BULLISH";
  if (score >= 55) return "SLIGHTLY_BULLISH";
  if (score >= 45) return "NEUTRAL";
  if (score >= 30) return "BEARISH";
  return "CRASH_WARNING";
}

function getMarketPattern({
  marketTrend,
  nikkei,
  topix,
  usdJpy,
  vix,
}: {
  marketTrend: string;
  nikkei: number | null;
  topix: number | null;
  usdJpy: number | null;
  vix: number | null;
}) {
  const parts: string[] = [marketTrend];

  if (typeof nikkei === "number") {
    if (nikkei >= 40000) parts.push("NIKKEI_HIGH");
    else if (nikkei <= 35000) parts.push("NIKKEI_LOW");
    else parts.push("NIKKEI_MIDDLE");
  }

  if (typeof topix === "number") {
    if (topix >= 2800) parts.push("TOPIX_HIGH");
    else if (topix <= 2400) parts.push("TOPIX_LOW");
    else parts.push("TOPIX_MIDDLE");
  }

  if (typeof usdJpy === "number") {
    if (usdJpy >= 160) parts.push("YEN_WEAK");
    else if (usdJpy <= 140) parts.push("YEN_STRONG");
    else parts.push("YEN_NORMAL");
  }

  if (typeof vix === "number") {
    if (vix >= 25) parts.push("VIX_HIGH");
    else if (vix <= 15) parts.push("VIX_LOW");
    else parts.push("VIX_NORMAL");
  }

  return parts.join("|");
}

function calculateMarketBonus(winRate: number, judgedCount: number) {
  if (judgedCount < 10) return 0;

  if (winRate >= 85) return 10;
  if (winRate >= 75) return 8;
  if (winRate >= 65) return 5;
  if (winRate >= 55) return 2;
  if (winRate >= 45) return 0;
  if (winRate >= 35) return -3;
  if (winRate >= 25) return -6;
  return -10;
}

function calculateConfidence(judgedCount: number) {
  if (judgedCount >= 100) return 100;
  if (judgedCount >= 30) return 80;
  if (judgedCount >= 10) return 50;
  return 0;
}

function createMarketComment(summary: {
  marketTrend: string;
  marketScore: number;
  winRate: number;
  judgedCount: number;
}) {
  if (summary.judgedCount === 0) {
    return `市場スコアは${summary.marketScore}です。現在は市場環境データを蓄積中です。`;
  }

  if (summary.winRate >= 75) {
    return `市場スコア${summary.marketScore}、市場勝率${summary.winRate}%です。この地合いではAI候補が強く機能しています。`;
  }

  if (summary.winRate >= 55) {
    return `市場スコア${summary.marketScore}、市場勝率${summary.winRate}%です。この地合いではAI候補が比較的安定しています。`;
  }

  return `市場スコア${summary.marketScore}、市場勝率${summary.winRate}%です。この地合いでは慎重な判断が必要です。`;
}

export function summarizeMarketLearning({
  tradeDate,
  stocks,
  nikkei = null,
  topix = null,
  usdJpy = null,
  vix = null,
}: MarketDataInput): MarketLearningSummary {
  const totalCount = stocks.length;
  const winCount = stocks.filter((stock) => stock.result === "WIN").length;
  const loseCount = stocks.filter((stock) => stock.result === "LOSE").length;
  const holdCount = stocks.filter((stock) => stock.result === "HOLD").length;
  const judgedCount = winCount + loseCount;
  const winRate =
    judgedCount === 0
      ? 0
      : Number(((winCount / judgedCount) * 100).toFixed(2));

  const marketScore = calculateMarketScore(stocks);
  const marketTrend = getMarketTrend(marketScore);
  const marketPattern = getMarketPattern({
    marketTrend,
    nikkei,
    topix,
    usdJpy,
    vix,
  });

  const aiBonus = calculateMarketBonus(winRate, judgedCount);
  const confidence = calculateConfidence(judgedCount);

  const marketComment = createMarketComment({
    marketTrend,
    marketScore,
    winRate,
    judgedCount,
  });

  return {
    tradeDate,
    nikkei,
    topix,
    usdJpy,
    vix,
    marketTrend,
    marketScore,
    marketPattern,
    marketComment,
    totalCount,
    winCount,
    loseCount,
    holdCount,
    judgedCount,
    winRate,
    aiBonus,
    confidence,
  };
}

export async function saveMarketLearning(input: MarketDataInput) {
  const summary = summarizeMarketLearning(input);

  await pool.query(
    `
    INSERT INTO market_learning_logs (
      trade_date,
      nikkei,
      topix,
      usd_jpy,
      vix,
      market_trend,
      market_score,
      market_comment,
      market_pattern,
      total_count,
      win_count,
      lose_count,
      hold_count,
      judged_count,
      win_rate,
      ai_bonus,
      confidence
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15, $16, $17
    )
    ON CONFLICT (trade_date)
    DO UPDATE SET
      nikkei = EXCLUDED.nikkei,
      topix = EXCLUDED.topix,
      usd_jpy = EXCLUDED.usd_jpy,
      vix = EXCLUDED.vix,
      market_trend = EXCLUDED.market_trend,
      market_score = EXCLUDED.market_score,
      market_comment = EXCLUDED.market_comment,
      market_pattern = EXCLUDED.market_pattern,
      total_count = EXCLUDED.total_count,
      win_count = EXCLUDED.win_count,
      lose_count = EXCLUDED.lose_count,
      hold_count = EXCLUDED.hold_count,
      judged_count = EXCLUDED.judged_count,
      win_rate = EXCLUDED.win_rate,
      ai_bonus = EXCLUDED.ai_bonus,
      confidence = EXCLUDED.confidence
    `,
    [
      summary.tradeDate,
      summary.nikkei,
      summary.topix,
      summary.usdJpy,
      summary.vix,
      summary.marketTrend,
      summary.marketScore,
      summary.marketComment,
      summary.marketPattern,
      summary.totalCount,
      summary.winCount,
      summary.loseCount,
      summary.holdCount,
      summary.judgedCount,
      summary.winRate,
      summary.aiBonus,
      summary.confidence,
    ]
  );

  return {
    marketAdded: 1,
    market: summary,
  };
}