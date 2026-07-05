import { calculateRiskScore, getRiskBonus } from "@/app/lib/riskBonus";
import { detectEventType } from "@/app/lib/eventType";
import { getEventBonus } from "@/app/lib/eventBonus";
import { getMarketBonus } from "@/app/lib/marketBonus";

import {
  calculateMarketLearningBonus,
  getLearningTimeBonus,
  getLearningVolatilityBonus,
  getLearningEventBonus,
  getLearningRiskBonus,
} from "@/app/lib/learning";

export type LatestMarketBonus = {
  bonus: number;
  winRate: number;
  confidence: number;
};

export async function getGlobalLearningContext(params: {
  marketPattern: string;
  latestMarketBonus: LatestMarketBonus;
}) {
  const marketLearning = calculateMarketLearningBonus({
    marketPattern: params.marketPattern,
    fixedBonus: getMarketBonus(params.marketPattern),
    latestMarketBonus: params.latestMarketBonus,
  });

  const timeLearning = await getLearningTimeBonus();

  return {
    marketLearning,
    marketBonus: marketLearning.bonus,
    timeLearning,
    timeBonus: timeLearning.bonus,
  };
}

export async function getStockLearningContext(params: {
  scored: any;
  volatility: number;
}) {
  const volatilityLearning = await getLearningVolatilityBonus(params.volatility);
  const volatilityBonus = volatilityLearning.bonus;

  const eventType = detectEventType(params.scored);
  const eventBonus = getEventBonus(eventType);
  const eventKey = eventType || "NO_EVENT";

  const eventLearning = getLearningEventBonus({
    eventKey,
    eventBonus,
    eventStatsMap: {},
  });

  const riskScore = calculateRiskScore({
    aiPower: params.scored.score,
    changePercent: params.scored.changePercent ?? 0,
    volatility: params.volatility,
  });

  const riskBonus = getRiskBonus(riskScore);
  const riskKey =
    riskBonus >= 0
      ? "LOW_RISK"
      : riskBonus <= -5
      ? "HIGH_RISK"
      : "MIDDLE_RISK";

  const riskLearning = getLearningRiskBonus({
    riskKey,
    riskBonus,
    riskStatsMap: {},
  });

  return {
    volatilityLearning,
    volatilityBonus,
    eventType,
    eventBonus,
    eventKey,
    eventLearning,
    riskScore,
    riskBonus,
    riskKey,
    riskLearning,
  };
}
