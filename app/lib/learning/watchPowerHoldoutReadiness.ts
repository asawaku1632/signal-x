import { evaluateWatchPowerHoldout, type WatchPowerRecord } from "./watchPowerHoldout";

/** Read-only, deterministic report. Never schedules work or initiates trades. */
export function getWatchPowerHoldoutReadiness(rows: WatchPowerRecord[]) {
  const result = evaluateWatchPowerHoldout(rows);
  const comparable = result.byDate.filter(date => date.differencePp !== null);
  const missingDates = result.byDate.filter(date => date.missingCount > 0).length;
  const incompleteDates = result.byDate.filter(date => date.differencePp === null).length;
  const minimum = result.hypothesis.minimumHoldoutDates;
  const remaining = Math.max(0, minimum - result.datesComparable);
  return {
    hypothesisVersion: result.hypothesis.version,
    freezeDate: result.hypothesis.frozenOn,
    earliestEligibleSignalDate: "2026-10-26",
    observedDates: result.datesObserved,
    comparableDates: result.datesComparable,
    remainingComparableDates: remaining,
    datesWithMissingOutcomes: missingDates,
    datesWithoutBothGroups: incompleteDates,
    conflictingDuplicates: result.conflictingDuplicates,
    status: result.conflictingDuplicates > 0 ? "DATA_CONFLICT" as const :
      result.readyForReview ? "REVIEW_READY" as const : "COLLECTING" as const,
    reviewReady: result.readyForReview,
    // Descriptive only: no automatic buy/sell, notification, or live ranking.
    dateEqualWeightDifferencePp: result.readyForReview ? result.meanDateDifferencePp : null,
    lowOutperformedDates: result.readyForReview ? result.lowOutperformedDates : null,
    comparableDateDetails: result.readyForReview ? comparable : [],
    note: "Research-only. Review-ready does not mean statistically significant or trade-ready.",
  };
}
