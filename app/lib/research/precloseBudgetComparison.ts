import {
  PRECLOSE_POLICY, statsForPreclose,
  type PrecloseObservation, type PrecloseStats,
} from "./precloseCandidateStudy.ts";

/**
 * Read-only historical comparison, NOT another certification gate.
 * Budget is a hypothetical maximum cost for exactly 100 shares.
 * Some securities (e.g. J-REITs/ETFs) trade in other units;
 * their actual tradability needs separate product-level confirmation.
 */
export const PRECLOSE_RESEARCH_BUDGETS = [100_000, 300_000, 500_000, 1_000_000] as const;

export type PrecloseBudgetRow = {
  budgetYen: number;
  eligibleObservedToday: number;
  researchCandidates: PrecloseObservation[];
  reference: PrecloseStats;
  referenceProfitableCount: number;
  referenceProfitableRate: number | null;
  worstPnl100: number | null;
};

function positive(x: number | null) {
  return x !== null && Number.isFinite(x) && x > 0;
}

export function fitsPrecloseBudget(row: PrecloseObservation, budgetYen: number) {
  return Number.isFinite(budgetYen) && budgetYen > 0
    && Number.isFinite(row.entryPrice) && row.entryPrice > 0
    && row.entryPrice * 100 <= budgetYen;
}

function passesAiPolicy(row: PrecloseObservation) {
  return row.aiPower !== null && Number.isFinite(row.aiPower)
    && row.aiPower >= PRECLOSE_POLICY.minAiPower;
}

export function comparePrecloseBudgets(rows: PrecloseObservation[], todayJst: string): PrecloseBudgetRow[] {
  // Reference includes archived/pre-policy dates, clearly labelled in UI.
  // Today and future outcomes never enter historical statistics.
  const settled = rows.filter((row) => row.tradeDate < todayJst
    && row.tradeDate < row.outcomeDate && row.outcomeDate <= todayJst
    && positive(row.outcomePrice) && positive(row.entryPrice)
    && passesAiPolicy(row));
  const today = rows.filter((row) => row.tradeDate === todayJst && positive(row.entryPrice))
    .sort((a, b) => (b.aiPower ?? -1) - (a.aiPower ?? -1)
      || a.code.localeCompare(b.code));

  return PRECLOSE_RESEARCH_BUDGETS.map((budgetYen) => {
    const history = settled.filter((row) => fitsPrecloseBudget(row, budgetYen));
    const profits = history.map((row) => ((row.outcomePrice as number) - row.entryPrice) * 100);
    const profitable = profits.filter((change) => change > 0).length;
    const eligibleToday = today.filter((row) => fitsPrecloseBudget(row, budgetYen));
    return {
      budgetYen,
      eligibleObservedToday: eligibleToday.length,
      researchCandidates: eligibleToday.filter(passesAiPolicy),
      reference: statsForPreclose(history),
      referenceProfitableCount: profitable,
      referenceProfitableRate: profits.length ? 100 * profitable / profits.length : null,
      worstPnl100: profits.length ? Math.min(...profits) : null,
    };
  });
}
