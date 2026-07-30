export function getEvidenceConfidenceStars(judgedTotal: number) {
  if (judgedTotal >= 100) return 5;
  if (judgedTotal >= 20) return 4;
  if (judgedTotal >= 5) return 3;
  if (judgedTotal >= 1) return 2;
  return 1;
}

export function formatStars(value: number) {
  const rating = Math.max(1, Math.min(5, Math.round(value)));
  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
}

export function getRankPercentile(rank: number, total: number) {
  if (!Number.isFinite(rank) || !Number.isFinite(total) || rank < 1 || total < 1) {
    return null;
  }

  const normalizedRank = Math.min(Math.round(rank), Math.round(total));
  const isTopHalf = normalizedRank <= total / 2;
  const position = isTopHalf ? normalizedRank : total - normalizedRank + 1;
  const percent = Math.max(1, Math.min(100, Math.round((position / total) * 100)));

  return `${isTopHalf ? "上位" : "下位"}${percent}%`;
}
