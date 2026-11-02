/**
 * Owner-only next-session budget shortlist (SHADOW / READ-ONLY).
 * Inputs are one completed session's saved AI snapshots. This function never
 * reads outcomes, future prices, earnings/news or live market data and cannot
 * conclude that a candidate will rise. Entry remains gated at 09:05+.
 */
export const NEXT_SESSION_BUDGET_WATCH_VERSION = "NEXT_SESSION_BUDGET_SHADOW_V1";
export const NEXT_SESSION_BUDGET_PRESETS = Object.freeze([100000, 300000, 350000, 500000]);

const validDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const numeric = (x) => x !== null && x !== undefined && x !== "" &&
  Number.isFinite(Number(x)) ? Number(x) : null;

/** A purely descriptive, deterministic ranking among eligible saved stocks. */
export function buildNextSessionBudgetWatch({
  rows, sourceDate, tradeDate, budgetYen = 350000,
  targetProfitYen = 7000, shares = 100, limit = 5,
}) {
  if (!validDate(sourceDate) || !validDate(tradeDate) || tradeDate <= sourceDate)
    throw Error("INVALID_MARKET_DATES");
  if (!NEXT_SESSION_BUDGET_PRESETS.includes(budgetYen) ||
    !Number.isInteger(shares) || shares !== 100 ||
    !Number.isInteger(targetProfitYen) || targetProfitYen <= 0 ||
    !Number.isInteger(limit) || limit < 1 || limit > 20)
    throw Error("INVALID_WATCH_POLICY");

  const unique = new Map();
  const conflicting = new Set();
  let invalidRows = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const code = String(row?.code ?? "");
    const score = numeric(row?.score);
    const price = numeric(row?.price);
    const rowDate = row?.snapshotDate ?? row?.date ?? sourceDate;
    if (!/^[0-9]{4}$/.test(code) || score === null || score < 85 || score > 100 ||
      price === null || price <= 0 || !Number.isFinite(price * shares) ||
      rowDate !== sourceDate || !String(row?.name ?? "").trim()) {
      invalidRows++;
      continue;
    }
    const stock = {code, name: String(row.name).trim(), score, referencePrice: price};
    const prior = unique.get(code);
    if (prior && (prior.score !== stock.score ||
      prior.referencePrice !== stock.referencePrice || prior.name !== stock.name)) {
      conflicting.add(code);
    } else if (!prior) {
      unique.set(code, stock);
    }
  }

  const eligible = [...unique.values()]
    .filter((row) => !conflicting.has(row.code) && row.referencePrice * shares <= budgetYen)
    .sort((a,b) => b.score - a.score || a.code.localeCompare(b.code));

  const candidates = eligible.slice(0, limit).map((stock,index) => {
    const referenceCostYen = Number((stock.referencePrice * shares).toFixed(2));
    return {
      ...stock, rank: index + 1, shares, referenceCostYen,
      referencePriceDate: sourceDate, targetTradeDate: tradeDate,
      targetProfitYen,
      requiredRiseYenPerShare: targetProfitYen / shares,
      requiredRisePercent: Number((targetProfitYen / referenceCostYen * 100).toFixed(2)),
      status: "RECHECK_AFTER_0905", catalystVerification: "NOT_VERIFIED",
      source: "daily_stock_results", evidence: "PRIOR_AI_ONLY",
    };
  });
  return {
    version: NEXT_SESSION_BUDGET_WATCH_VERSION,
    sourceDate, tradeDate, budgetYen, shares, targetProfitYen,
    eligibleCount: eligible.length, conflictsExcluded: conflicting.size,
    invalidRows, candidates,
    status: candidates.length ? "REFERENCE_ONLY" : "NO_ELIGIBLE_CANDIDATES",
  };
}
