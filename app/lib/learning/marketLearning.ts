export type MarketLearningResult = {
  marketPattern: string;
  bonus: number;
  winRate: number;
  confidence: number;
  source: "fixed" | "learning";
};

export function calculateMarketLearningBonus(params: {
  marketPattern: string;
  fixedBonus: number;
  latestMarketBonus?: {
    bonus: number;
    winRate: number;
    confidence: number;
  };
}): MarketLearningResult {
  const latest = params.latestMarketBonus;

  if (latest && latest.confidence >= 50) {
    return {
      marketPattern: params.marketPattern,
      bonus: latest.bonus,
      winRate: latest.winRate,
      confidence: latest.confidence,
      source: "learning",
    };
  }

  return {
    marketPattern: params.marketPattern,
    bonus: params.fixedBonus,
    winRate: latest?.winRate ?? 0,
    confidence: latest?.confidence ?? 0,
    source: "fixed",
  };
}