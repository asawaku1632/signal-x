/**
 * Read-only, owner-facing readiness gate for five distinct research alerts.
 * This module intentionally has no dispatch or database writes.
 */
export const FIVE_SIGNAL_RESEARCH_ALERTS = [
  { key: "exploded", label: "🚀 爆上げ", evidence: "confirmed_price_and_volume" },
  { key: "surge_precursor", label: "🔭 急騰前兆", evidence: "forward_research" },
  { key: "surge_start", label: "⚡ 急騰開始", evidence: "confirmed_momentum" },
  { key: "explosive_candidate", label: "📈 爆上げ候補", evidence: "forward_research" },
  { key: "profit_precursor", label: "👑 爆益前兆", evidence: "forward_research" },
] as const;

export type FiveSignalKey = (typeof FIVE_SIGNAL_RESEARCH_ALERTS)[number]["key"];
export type ResearchAlertInput = {
  signal: FiveSignalKey;
  code: string;
  observedAt: string | null;
  priceYen: number | null;
  volumeRatio20d: number | null;
  momentumPct: number | null;
  divergence: "BULLISH" | "BEARISH" | "NONE" | "UNKNOWN";
  evidenceVerified: boolean;
  completedForwardDays: number;
  completedForwardCodes: number;
  completedForwardObservations: number;
  isOwner: boolean;
};

export type ResearchAlertReadiness = {
  eligibleForOwnerPreview: boolean;
  eligibleForDelivery: false;
  label: "RESEARCH_ONLY" | "INSUFFICIENT_EVIDENCE";
  reasons: string[];
  budgetYen: number | null;
};

export function evaluateFiveSignalResearchAlert(input: ResearchAlertInput): ResearchAlertReadiness {
  const reasons: string[] = [];
  if (!input.isOwner) reasons.push("OWNER_ONLY");
  if (!FIVE_SIGNAL_RESEARCH_ALERTS.some(({ key }) => key === input.signal)) reasons.push("UNKNOWN_SIGNAL");
  if (!/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(input.code)) reasons.push("INVALID_CODE");
  if (input.code === "9984") reasons.push("EXCLUDED_CODE");
  if (!input.observedAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(input.observedAt) || !Number.isFinite(Date.parse(input.observedAt))) reasons.push("MISSING_OBSERVATION_TIME");
  if (input.priceYen === null || !Number.isFinite(input.priceYen) || input.priceYen <= 0) {
    reasons.push("MISSING_VALID_PRICE");
  }
  const budgetYen = input.priceYen !== null && Number.isFinite(input.priceYen) && input.priceYen > 0
    ? Math.round(input.priceYen * 100) : null;
  if (budgetYen === null || budgetYen < 100_000 || budgetYen > 500_000) reasons.push("OUTSIDE_100_SHARE_BUDGET");
  if (!input.evidenceVerified) reasons.push("UNVERIFIED_RESEARCH");
  if (![input.completedForwardDays, input.completedForwardCodes, input.completedForwardObservations].every(
    (value) => Number.isSafeInteger(value) && value >= 0,
  )) reasons.push("INVALID_FORWARD_COUNTS");
  else if (input.completedForwardDays < 15 || input.completedForwardCodes < 30 ||
      input.completedForwardObservations < 50) reasons.push("INSUFFICIENT_FORWARD_COVERAGE");
  if (!["BULLISH", "BEARISH", "NONE", "UNKNOWN"].includes(input.divergence)) reasons.push("INVALID_DIVERGENCE");
  if (input.divergence === "BEARISH") reasons.push("BEARISH_DIVERGENCE_WARNING");
  if (input.momentumPct === null || !Number.isFinite(input.momentumPct)) reasons.push("MOMENTUM_UNAVAILABLE");
  if (input.volumeRatio20d !== null && (!Number.isFinite(input.volumeRatio20d) || input.volumeRatio20d < 0)) reasons.push("INVALID_VOLUME_RATIO");
  else if (input.volumeRatio20d === null) reasons.push("VOLUME_UNAVAILABLE");
  return {
    eligibleForOwnerPreview: input.isOwner && reasons.every((reason) =>
      reason === "UNVERIFIED_RESEARCH" || reason === "INSUFFICIENT_FORWARD_COVERAGE" ||
      reason === "BEARISH_DIVERGENCE_WARNING" || reason === "MOMENTUM_UNAVAILABLE" ||
      reason === "VOLUME_UNAVAILABLE"),
    eligibleForDelivery: false,
    label: reasons.length === 0 ? "RESEARCH_ONLY" : "INSUFFICIENT_EVIDENCE",
    reasons,
    budgetYen,
  };
}
