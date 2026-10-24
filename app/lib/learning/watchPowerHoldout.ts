/** Research-only frozen WATCH hypothesis. No database access or trading actions. */
export const WATCH_POWER_HYPOTHESIS = {
  version: "watch-power-low-vs-high-20261024-v1",
  frozenOn: "2026-10-24",
  trainingEndDate: "2026-10-16",
  lowPowerExclusive: 68,
  highPowerInclusive: 71,
  horizonTradingDays: 5,
  minimumHoldoutDates: 10,
} as const;

export type WatchPowerRecord = {
  code: string;
  signalDate: string; // YYYY-MM-DD; date of precommitted WATCH label
  status: "WATCH" | "AVOID" | "WAIT" | "CANDIDATE";
  aiPowerAtSignal: number | null;
  return5dPct: number | null;
};

type Group = "low" | "high";
const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/**
 * Holdout evaluation only: excludes all pre-freeze signal dates.
 * Deduplicates stock/date records, rejecting conflicting duplicate observations.
 * A missing outcome is not treated as a zero return.
 * Per-date group comparisons avoid pooling all stocks as independent market dates.
 */
export function evaluateWatchPowerHoldout(rows: WatchPowerRecord[]) {
  const byKey = new Map<string, WatchPowerRecord>();
  let conflictingDuplicates = 0;
  const rejectedKeys = new Set<string>();
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.signalDate)) continue;
    if (row.signalDate <= WATCH_POWER_HYPOTHESIS.trainingEndDate) continue;
    if (row.status !== "WATCH" || !row.code.trim()) continue;
    const key = JSON.stringify([row.signalDate, row.code]);
    if (rejectedKeys.has(key)) continue;
    const previous = byKey.get(key);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(row)) {
        conflictingDuplicates++;
        byKey.delete(key);
        rejectedKeys.add(key);
      }
      continue;
    }
    byKey.set(key, row);
  }

  const groups = new Map<string, { low: number[]; high: number[]; missing: number }>();
  for (const row of byKey.values()) {
    const bucket = groups.get(row.signalDate) ?? { low: [], high: [], missing: 0 };
    groups.set(row.signalDate, bucket);
    if (row.aiPowerAtSignal === null || !Number.isFinite(row.aiPowerAtSignal) ||
        row.return5dPct === null || !Number.isFinite(row.return5dPct)) {
      bucket.missing++;
      continue;
    }
    const group: Group | null = row.aiPowerAtSignal < WATCH_POWER_HYPOTHESIS.lowPowerExclusive
      ? "low" : row.aiPowerAtSignal >= WATCH_POWER_HYPOTHESIS.highPowerInclusive
        ? "high" : null;
    if (group) bucket[group].push(row.return5dPct);
  }

  const byDate = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([date, group]) => {
    const lowMeanPct = mean(group.low);
    const highMeanPct = mean(group.high);
    return {
      date, lowCount: group.low.length, highCount: group.high.length,
      missingCount: group.missing,
      lowMeanPct, highMeanPct,
      differencePp: lowMeanPct === null || highMeanPct === null ? null : lowMeanPct - highMeanPct,
    };
  });
  const comparable = byDate.filter(date => date.differencePp !== null);
  return {
    hypothesis: WATCH_POWER_HYPOTHESIS,
    datesObserved: byDate.length,
    datesComparable: comparable.length,
    meanDateDifferencePp: mean(comparable.map(date => date.differencePp as number)),
    lowOutperformedDates: comparable.filter(date => (date.differencePp as number) > 0).length,
    conflictingDuplicates,
    readyForReview: comparable.length >= WATCH_POWER_HYPOTHESIS.minimumHoldoutDates &&
      conflictingDuplicates === 0,
    byDate,
    note: "Exploratory frozen thresholds; no next-session execution, costs, sector control, or statistical significance test. Do not use for trades.",
  };
}
