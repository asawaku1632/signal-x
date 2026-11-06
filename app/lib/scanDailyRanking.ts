/**
 * Presentation-only ranking for a saved scan snapshot.
 *
 * Apply the 100-share affordability constraint BEFORE choosing the top N.
 * Otherwise a budget-limited user can see zero picks even when affordable
 * stocks are present lower in the fetched scan snapshot.
 *
 * This does not estimate future returns, validate entry timing or claim a
 * statistically measured win rate. Its universe is only the stocks supplied
 * by /api/scan, not necessarily every stock in the market.
 */
export type DailyScanFilter = "hot" | "strong" | "market-hot" | "market-watch" | "all";
export type DailyScanSort = "score" | "change" | "down" | "cheap" | "expensive" | "money";

export type DailyScanStock = {
  code: string;
  score: number;
  price: number;
  changePercent: number;
  volumeRatio: number;
};

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function byScore(a: DailyScanStock, b: DailyScanStock): number {
  return (
    b.score - a.score ||
    finite(b.changePercent) - finite(a.changePercent) ||
    finite(b.volumeRatio) - finite(a.volumeRatio) ||
    a.code.localeCompare(b.code, "ja", { numeric: true })
  );
}

export function rankDailyScanCandidates<T extends DailyScanStock>(
  stocks: readonly T[],
  options: { budget: number | "all"; filter: DailyScanFilter; sort: DailyScanSort },
): T[] {
  const affordable = stocks
    .filter((stock) =>
      Number.isFinite(stock.score) &&
      Number.isFinite(stock.price) &&
      stock.price > 0 &&
      (options.budget === "all" || stock.price * 100 <= options.budget),
    )
    .sort(byScore);

  // A "top 10" ranking is calculated within the chosen budget, not globally.
  const pool = options.filter === "hot"
    ? affordable.slice(0, 3)
    : options.filter === "strong"
      ? affordable.slice(0, 10)
      : options.filter === "market-hot"
        ? affordable.filter((stock) => stock.score >= 75)
        : options.filter === "market-watch"
          ? affordable.filter((stock) => stock.score >= 65 && stock.score < 75)
          : affordable;

  const sortValue = (stock: T): number => {
    if (options.sort === "change" || options.sort === "down") return finite(stock.changePercent);
    if (options.sort === "cheap" || options.sort === "expensive") return stock.price;
    if (options.sort === "money") return stock.price * 100;
    return stock.score;
  };
  return [...pool].sort((a, b) => {
    if (options.sort === "score") return byScore(a, b);
    const direction = options.sort === "change" || options.sort === "expensive" ? -1 : 1;
    return direction * (sortValue(a) - sortValue(b)) || byScore(a, b);
  });
}
