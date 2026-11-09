export const FORWARD_DAYS = [1, 3, 5, 10] as const;
export type ForwardDays = (typeof FORWARD_DAYS)[number];
export type ForwardStatus = "HOLD" | "EXIT";
export type ForwardCohort = "MANUAL" | "CRON";
export type ForwardOutcome = {
  days: number;
  date: string | null;
  price: number | null;
  changePercent: number | null;
};
export type ForwardItem = {
  id: string;
  code: string;
  name: string;
  signalDate: string;
  scanAt: string;
  decisionStatus: ForwardStatus;
  cohort: ForwardCohort;
  signalPrice: number;
  aiPower: number;
  reasons: string[];
  outcomes: ForwardOutcome[];
};
export function summarizeDecisionForward(items: ForwardItem[]) {
  return (["MANUAL", "CRON"] as const).flatMap(cohort =>
    (["HOLD", "EXIT"] as const).map(decisionStatus => {
      const group = items.filter(item => item.cohort === cohort && item.decisionStatus === decisionStatus);
      return {
        cohort, decisionStatus, total: group.length,
        codes: new Set(group.map(item => item.code)).size,
        horizons: FORWARD_DAYS.map(days => {
          const returns = group.flatMap(item => {
            const outcome = item.outcomes.find(value => value.days === days);
            return outcome?.changePercent == null || !Number.isFinite(outcome.changePercent)
              ? [] : [outcome.changePercent];
          }).sort((a, b) => a - b);
          const n = returns.length;
          const correct = returns.filter(value => decisionStatus === "EXIT" ? value < 0 : value > 0).length;
          return {
            days, evaluated: n, correct,
            correctRate: n ? correct / n * 100 : null,
            averagePercent: n ? returns.reduce((sum, value) => sum + value, 0) / n : null,
            medianPercent: n ? (returns[Math.floor((n - 1) / 2)] + returns[Math.floor(n / 2)]) / 2 : null,
          };
        }),
      };
    }),
  );
}
