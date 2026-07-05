import { calculateRiskScore, getRiskBonus } from "@/app/lib/riskBonus";
import { detectEventType } from "@/app/lib/eventType";
import { getEventBonus } from "@/app/lib/eventBonus";
import { getMarketBonus } from "@/app/lib/marketBonus";
import { getSectorKey, getSectorLabel } from "@/app/lib/sectorMap";
import { createExperienceKey } from "@/app/lib/experienceLearning";
import { calculateLearningBonus } from "@/app/lib/learningBonus";
import { calculatePatternBonus } from "@/app/lib/patternBonus";
import { calculateSectorBonus } from "@/app/lib/sectorBonus";
import { calculateAiPower } from "./aiPowerEngine";
import { buildScoreBreakdown } from "./scoreBreakdownBuilder";
import { getLearningResult } from "./learningEngine";
import { getExperienceResult } from "./experienceEngine";

type PipelineParams = {
  scored: any;
  marketPattern: string;
  latestMarketBonus: {
    bonus: number;
    winRate: number;
    confidence: number;
  };
  timeLearning: any;
  learningStatsMap: Map<string, any>;
  patternStatsMap: Map<string, any>;
  weightRuleMap: Map<string, any>;
  sectorStatsMap: Map<string, any>;
  sectorWeightRuleMap: Map<string, any>;
  experienceBonusMap: Map<string, any>;
  similarExperienceBonusMap: Map<string, any>;
  experienceRankingMap: Map<string, any>;
};

export async function runAiPipeline(params: PipelineParams) {
  const {
    scored,
    marketPattern,
    latestMarketBonus,
    timeLearning,
    learningStatsMap,
    patternStatsMap,
    weightRuleMap,
    sectorStatsMap,
    sectorWeightRuleMap,
    experienceBonusMap,
    similarExperienceBonusMap,
    experienceRankingMap,
  } = params;

  const sectorKey = getSectorKey(scored.code);
  const sectorLabel = getSectorLabel(scored.code);

  const experienceKey = createExperienceKey({
    patternKey: scored.patternKey,
    sectorKey,
    marketPattern,
  });

  const learningStats = learningStatsMap.get(scored.code);
  const judgedLearning =
    (learningStats?.win ?? 0) + (learningStats?.lose ?? 0);

  const learning =
    judgedLearning > 0
      ? calculateLearningBonus(learningStats?.winRate)
      : {
          bonus: 0,
          winRate: 0,
        };

  const patternStats = patternStatsMap.get(scored.patternKey);
  const pattern = calculatePatternBonus({
    win: patternStats?.win ?? 0,
    lose: patternStats?.lose ?? 0,
  });

  const weightRule = weightRuleMap.get(scored.patternKey);
  const finalPatternBonus = weightRule ? weightRule.bonus : pattern.bonus;

  const sectorStats = sectorStatsMap.get(sectorKey);
  const calculatedSector = calculateSectorBonus({
    win: sectorStats?.win ?? 0,
    lose: sectorStats?.lose ?? 0,
  });

  const sectorWeightRule = sectorWeightRuleMap.get(sectorKey);
  const finalSectorBonus = sectorWeightRule
    ? sectorWeightRule.bonus
    : calculatedSector.bonus;

  const volatility = Math.abs(scored.changePercent ?? 0);

  const eventType = detectEventType(scored);
  const eventBonus = getEventBonus(eventType);
  const eventKey = eventType || "NO_EVENT";

  const riskScore = calculateRiskScore({
    aiPower: scored.score,
    changePercent: scored.changePercent ?? 0,
    volatility,
  });

  const riskBonus = getRiskBonus(riskScore);
  const riskKey =
    riskBonus >= 0
      ? "LOW_RISK"
      : riskBonus <= -5
      ? "HIGH_RISK"
      : "MIDDLE_RISK";

  const learningResult = await getLearningResult({
    marketPattern,
    fixedMarketBonus: getMarketBonus(marketPattern),
    latestMarketBonus,
    timeLearning,
    volatility,
    eventKey,
    eventBonus,
    riskKey,
    riskBonus,
  });

  const experienceResult = getExperienceResult({
    experienceKey,
    experienceBonusMap,
    similarExperienceBonusMap,
    experienceRankingMap,
  });

  const finalScore = calculateAiPower({
    baseScore: scored.score,
    marketBonus: learningResult.market.bonus,
    timeBonus: learningResult.time.bonus,
    volatilityBonus: learningResult.volatility.bonus,
    eventBonus: learningResult.event.bonus,
    riskBonus: learningResult.risk.bonus,
    learningBonus: learning.bonus,
    patternBonus: finalPatternBonus,
    sectorBonus: finalSectorBonus,
    experienceBonus: experienceResult.experience.bonus,
    similarExperienceBonus: experienceResult.similarExperience.bonus,
    experienceRankingBonus: experienceResult.experienceRanking.bonus,
  });

  const timeLearningReason =
    learningResult.time.bonus > 0
      ? `時間帯学習 +${learningResult.time.bonus}`
      : learningResult.time.bonus < 0
      ? `時間帯学習 ${learningResult.time.bonus}`
      : "";

  const reasons = [scored.reason, timeLearningReason].filter(Boolean);

  const scoreBreakdown = buildScoreBreakdown({
    scored,
    learningResult,
    learningBonus: learning.bonus,
    patternLearningBonus: finalPatternBonus,
    sectorBonus: finalSectorBonus,
    experienceResult,
  });

  return {
    ...scored,
    sectorKey,
    sectorLabel,
    experienceKey,
    marketPattern,
    score: finalScore,
    aiPower: finalScore,
    timeSlot: learningResult.time.timeSlot,
    timeBonusSource: learningResult.time.source,
    timeWinRate: learningResult.time.winRate,
    timeJudged: learningResult.time.judged,
    timeConfidence: learningResult.time.confidence,
    rank:
      finalScore >= 85
        ? "S"
        : finalScore >= 70
        ? "A"
        : finalScore >= 50
        ? "B"
        : "C",
    scoreBreakdown,
    reason: reasons.join("・"),
  };
}
