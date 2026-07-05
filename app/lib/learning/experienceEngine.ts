import { createExperienceKey } from "@/app/lib/experienceLearning";
import { getExperienceBonusMap } from "@/app/lib/experienceBonus";
import { getSimilarExperienceBonusMap } from "@/app/lib/similarExperience";
import { getExperienceRankingMap } from "@/app/lib/experienceRanking";

export type ExperienceLearningMaps = {
  experienceBonusMap: Map<string, any>;
  similarExperienceBonusMap: Map<string, any>;
  experienceRankingMap: Map<string, any>;
};

export function buildExperienceKey(params: {
  patternKey: string;
  sectorKey: string;
  marketPattern: string;
}) {
  return createExperienceKey(params);
}

export function buildExperienceKeys(params: {
  stocks: any[];
  marketPattern: string;
  getSectorKey: (code: string) => string;
}) {
  return params.stocks.map((stock) => {
    const sectorKey = params.getSectorKey(stock.code);

    return buildExperienceKey({
      patternKey: stock.patternKey,
      sectorKey,
      marketPattern: params.marketPattern,
    });
  });
}

export async function getExperienceLearningMaps(
  experienceKeys: string[]
): Promise<ExperienceLearningMaps> {
  const [
    experienceBonusMap,
    similarExperienceBonusMap,
    experienceRankingMap,
  ] = await Promise.all([
    getExperienceBonusMap(experienceKeys),
    getSimilarExperienceBonusMap(experienceKeys, {
      minSimilarity: 70,
      limit: 300,
    }),
    getExperienceRankingMap(experienceKeys, {
      minSimilarity: 70,
      candidateLimit: 500,
      topLimit: 10,
    }),
  ]);

  return {
    experienceBonusMap,
    similarExperienceBonusMap,
    experienceRankingMap,
  };
}
