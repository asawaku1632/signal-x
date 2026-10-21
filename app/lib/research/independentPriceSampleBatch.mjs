// Pure owner-research batch comparison. No API access, persistence, or verification grants.
import { compareIndependentDailyReference } from "./independentPriceComparison.mjs";

export const RESEARCH_SAMPLE_CODES = Object.freeze(["3996", "3762", "4493"]);
export const MAX_RESEARCH_COMPARISONS = 20;

export function compareResearchSampleRows(rows) {
  if (!Array.isArray(rows) || rows.length > MAX_RESEARCH_COMPARISONS) {
    throw new Error("INVALID_RESEARCH_BATCH");
  }
  const seen = new Set();
  const results = rows.map((row) => {
    if (!RESEARCH_SAMPLE_CODES.includes(String(row?.code ?? ""))) {
      throw new Error("CODE_OUTSIDE_RESEARCH_SAMPLE");
    }
    const key = String(row.code) + ":" + String(row.tradeDate);
    if (seen.has(key)) throw new Error("DUPLICATE_RESEARCH_SAMPLE");
    seen.add(key);
    return compareIndependentDailyReference(row);
  });
  const reasonCounts = {};
  for (const result of results) {
    for (const reason of result.reasons) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  }
  return {
    total: results.length,
    reviewRequired: results.filter((result) => result.comparisonStatus === "REVIEW_REQUIRED").length,
    comparableForManualReview: results.filter((result) => result.comparisonStatus === "COMPARABLE_FOR_MANUAL_REVIEW").length,
    verifiedReturns: 0,
    reasonCounts,
    results,
    caveat: "Fixed research sample only. No automated provider fetch, writes, or validated returns.",
  };
}
