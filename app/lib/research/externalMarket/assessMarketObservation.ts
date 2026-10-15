/**
 * SIGNALX external market shadow research.
 * Pure functions only: no DB, network, orders, notifications, or AI score mutations.
 */
export type MarketObservation = {
  symbol: string;
  value: number | null;
  observedAt: string;
  availableAt: string;
  source: string;
};

export type MarketAssessment =
  | { status: "usable"; observation: MarketObservation; ageMinutes: number }
  | { status: "missing" | "invalid" | "future" | "stale"; observation: null };

export function assessMarketObservation(
  observation: MarketObservation | null,
  decisionAt: string,
  maxAgeMinutes: number,
): MarketAssessment {
  if (!observation) return { status: "missing", observation: null };
  const decision = Date.parse(decisionAt);
  const observed = Date.parse(observation.observedAt);
  const available = Date.parse(observation.availableAt);
  if (
    !observation.symbol.trim() ||
    !observation.source.trim() ||
    observation.value === null ||
    !Number.isFinite(observation.value) ||
    observation.value <= 0 ||
    !Number.isFinite(decision) ||
    !Number.isFinite(observed) ||
    !Number.isFinite(available) ||
    !Number.isFinite(maxAgeMinutes) ||
    maxAgeMinutes < 0 ||
    available < observed
  ) return { status: "invalid", observation: null };
  // A historical decision must never see data that arrived afterwards.
  if (observed > decision || available > decision) {
    return { status: "future", observation: null };
  }
  const ageMinutes = (decision - observed) / 60_000;
  if (ageMinutes > maxAgeMinutes) return { status: "stale", observation: null };
  return { status: "usable", observation, ageMinutes };
}
