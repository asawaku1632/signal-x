export type SectorRankingInput = {
  sectorKey: string;
  sectorName: string;
  winRate: number;
  aiBonus: number;
  confidence: number;
  total: number;
};

export type SectorRankingResult = SectorRankingInput & {
  aiScore: number;
};

export function calculateSectorAIScore(
  sector: SectorRankingInput
): SectorRankingResult {
  const score =
    sector.winRate * 0.5 +
    sector.aiBonus * 5 +
    sector.confidence * 0.2;

  return {
    ...sector,
    aiScore: Math.round(score),
  };
}

export function rankSectors(
  sectors: SectorRankingInput[]
): SectorRankingResult[] {
  return sectors
    .map(calculateSectorAIScore)
    .sort((a, b) => b.aiScore - a.aiScore);
}