export function normalizeRankingUniverseCount(value: unknown): number | null {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : null;
}

export function formatAiRankingPosition(
  rank: number,
  rankingUniverseCount: unknown,
) {
  const count = normalizeRankingUniverseCount(rankingUniverseCount);
  return count === null
    ? `${rank}位（母数不明）`
    : `${rank}位 / ${count.toLocaleString("ja-JP")}銘柄中`;
}
