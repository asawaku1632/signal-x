export function getAiRank(score: number) {
  if (score >= 95) {
    return {
      rank: "S",
      icon: "◎",
      stars: "★★★★★",
      color: "text-yellow-500",
      bg: "bg-yellow-50 border-yellow-300",
      comment: "非常に評価が高い候補",
    };
  }

  if (score >= 85) {
    return {
      rank: "A",
      icon: "○",
      stars: "★★★★☆",
      color: "text-red-500",
      bg: "bg-red-50 border-red-300",
      comment: "評価が高い候補",
    };
  }

  if (score >= 70) {
    return {
      rank: "B",
      icon: "△",
      stars: "★★★☆☆",
      color: "text-green-600",
      bg: "bg-green-50 border-green-300",
      comment: "条件を確認したい候補",
    };
  }

  if (score >= 50) {
    return {
      rank: "C",
      icon: "◇",
      stars: "★★☆☆☆",
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-300",
      comment: "慎重に確認したい候補",
    };
  }

  return {
    rank: "D",
    icon: "―",
    stars: "★☆☆☆☆",
    color: "text-gray-500",
    bg: "bg-gray-100 border-gray-300",
    comment: "現時点では様子を見たい候補",
  };
}
