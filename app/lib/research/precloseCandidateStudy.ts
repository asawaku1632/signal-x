/**
 * 15:15 pre-close research only. Pure read-side statistics:
 * no scans, orders, notification changes, writes, or adaptive optimizers.
 * A single policy is frozen ahead of further data accumulation.
 */
export const PRECLOSE_POLICY = Object.freeze({
  observationSlot: "15:15",
  prospectiveStartDate: "2026-10-16", // frozen after the initial 10/13–15 exploratory findings
  minAiPower: 90,
  trainingDays: 20,
  holdoutDays: 10,
  trainingSamples: 120,
  holdoutSamples: 60,
  trainingDecisive: 50,
  holdoutDecisive: 25,
  minDecisiveWinRate: 60,
  assumedRoundTripCostPct: 0.4, // illustrative friction haircut, not a broker fee quote
  minHoldoutNetReturnPct: 0,
  minBenchmarkImprovementPct: 0.3,
  worstPermittedReturnPct: -10,
} as const);

export type PrecloseObservation = {
  tradeDate: string;
  outcomeDate: string;
  code: string;
  name: string;
  entryPrice: number;
  aiPower: number | null;
  sampledAt: string;
  outcomePrice: number | null;
};

export type PrecloseStats = {
  observedDays: number;
  samples: number;
  wins: number;
  losses: number;
  holds: number;
  decisive: number;
  winRate: number | null;
  meanChangePct: number | null;
  meanPnl100: number | null;
  worstChangePct: number | null;
};

const finitePositive = (x: number | null) => x !== null && Number.isFinite(x) && x > 0;
const percent = (observation: PrecloseObservation) =>
  100 * ((observation.outcomePrice as number) - observation.entryPrice) / observation.entryPrice;

export function statsForPreclose(rows: PrecloseObservation[]): PrecloseStats {
  const valid = rows.filter((row) => finitePositive(row.entryPrice) && finitePositive(row.outcomePrice));
  const changes = valid.map(percent);
  const wins = changes.filter((change) => change >= 2).length;
  const losses = changes.filter((change) => change <= -2).length;
  const holds = changes.length - wins - losses;
  const decisive = wins + losses;
  return {
    observedDays: new Set(valid.map((row) => row.tradeDate)).size,
    samples: valid.length, wins, losses, holds, decisive,
    winRate: decisive ? 100 * wins / decisive : null,
    meanChangePct: changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null,
    meanPnl100: valid.length
      ? valid.reduce((sum, row) => sum + ((row.outcomePrice as number) - row.entryPrice) * 100, 0) / valid.length
      : null,
    worstChangePct: changes.length ? Math.min(...changes) : null,
  };
}

export function analyzePrecloseStudy(rows: PrecloseObservation[], todayJst: string) {
  // Never let a current-date result, if prematurely present, certify that date's candidates.
  const past = rows.filter((row) => row.tradeDate < todayJst
    && row.tradeDate < row.outcomeDate && row.outcomeDate <= todayJst
    && finitePositive(row.entryPrice));
  const settled = past.filter((row) => finitePositive(row.outcomePrice));
  // Dates before freezing the policy remain visible in the historical audit,
  // but never contribute to training, holdout, or the qualification gate.
  const prospective = settled.filter((row) =>
    row.tradeDate >= PRECLOSE_POLICY.prospectiveStartDate);
  const dated = [...new Set(prospective.map((row) => row.tradeDate))].sort();
  const earlier = new Set(dated.slice(0, PRECLOSE_POLICY.trainingDays));
  // Nonoverlapping later observations. After qualification, roll the
  // recent ten days forward; deteriorating performance revokes the gate.
  const lastHoldout = new Set(dated.slice(PRECLOSE_POLICY.trainingDays)
    .slice(-PRECLOSE_POLICY.holdoutDays));
  const filtered = (source: PrecloseObservation[]) =>
    source.filter((row) => row.aiPower !== null && Number.isFinite(row.aiPower)
      && row.aiPower >= PRECLOSE_POLICY.minAiPower);
  const training = statsForPreclose(filtered(prospective.filter((row) => earlier.has(row.tradeDate))));
  const holdoutRows = prospective.filter((row) => lastHoldout.has(row.tradeDate));
  const validation = statsForPreclose(filtered(holdoutRows));
  const baseline = statsForPreclose(holdoutRows);
  const improvement = validation.meanChangePct === null || baseline.meanChangePct === null
    ? null : validation.meanChangePct - baseline.meanChangePct;
  const needs = [
    { name: "過去の観測日", current: dated.length, min: PRECLOSE_POLICY.trainingDays + PRECLOSE_POLICY.holdoutDays },
    { name: "学習期間の評価日", current: training.observedDays, min: PRECLOSE_POLICY.trainingDays },
    { name: "別期間の評価日", current: validation.observedDays, min: PRECLOSE_POLICY.holdoutDays },
    { name: "学習期間の評価件数", current: training.samples, min: PRECLOSE_POLICY.trainingSamples },
    { name: "別期間の評価件数", current: validation.samples, min: PRECLOSE_POLICY.holdoutSamples },
    { name: "学習期間の±2%判定", current: training.decisive, min: PRECLOSE_POLICY.trainingDecisive },
    { name: "別期間の±2%判定", current: validation.decisive, min: PRECLOSE_POLICY.holdoutDecisive },
  ];
  const enough = needs.every((item) => item.current >= item.min);
  const passed = enough
    && training.winRate !== null && training.winRate >= PRECLOSE_POLICY.minDecisiveWinRate
    && validation.winRate !== null && validation.winRate >= PRECLOSE_POLICY.minDecisiveWinRate
    && validation.meanChangePct !== null
    && validation.meanChangePct - PRECLOSE_POLICY.assumedRoundTripCostPct >
      PRECLOSE_POLICY.minHoldoutNetReturnPct
    && improvement !== null && improvement >= PRECLOSE_POLICY.minBenchmarkImprovementPct
    && validation.worstChangePct !== null
    && validation.worstChangePct >= PRECLOSE_POLICY.worstPermittedReturnPct;

  const today = rows.filter((row) => row.tradeDate === todayJst && finitePositive(row.entryPrice))
    .sort((a, b) => (b.aiPower ?? -1) - (a.aiPower ?? -1) || a.code.localeCompare(b.code));
  const researchCandidates = filtered(today);
  const history = settled.slice().sort((a, b) => b.tradeDate.localeCompare(a.tradeDate)
    || a.code.localeCompare(b.code)).slice(0, 30);
  return {
    policy: PRECLOSE_POLICY, date: todayJst, availableDays: dated.length,
    totalSaved: rows.length, settled: settled.length, todaySaved: today.length,
    researchCandidates, verifiedCandidates: passed ? researchCandidates : [],
    phase: !enough ? "COLLECTING" as const : passed ? "REFERENCE_PASSED" as const : "NOT_PASSED" as const,
    training, validation, baseline, improvement, needs, history,
  };
}
