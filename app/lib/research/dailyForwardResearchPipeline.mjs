import { adaptDailySnapshotsForForwardResearch, adaptLicensedDailyClosesForForwardResearch } from "./dailyForwardInputAdapter.mjs";
import { evaluateDailyForward, FORWARD_HORIZONS } from "./dailyForwardEvaluation.mjs";

/**
 * Offline orchestration only. Does not access database, APIs or credentials.
 * The legacy snapshot price is unverified, so legacy-based returns fail closed.
 * A future audited close-to-close baseline must be supplied separately, never
 * by silently re-labelling historical scan prices as official close.
 */
export function buildDailyForwardResearchReport({
  snapshotRows, licensedDailyRows, verifiedSessions, horizons = FORWARD_HORIZONS,
}) {
  const predictions = adaptDailySnapshotsForForwardResearch(snapshotRows);
  const closes = adaptLicensedDailyClosesForForwardResearch(licensedDailyRows);
  const result = evaluateDailyForward({
    predictions, closes, sessions: verifiedSessions, horizons,
  });
  return {
    version: 1,
    mode: "OFFLINE_RESEARCH_ONLY",
    referenceBasis: "LEGACY_SCAN_PRICE_UNVERIFIED",
    inputCounts: {
      predictions: predictions.length,
      dailyCloses: closes.length,
      tradingSessions: verifiedSessions.length,
    },
    ...result,
    warning: "No legacy Yahoo scan price is certified comparable to official daily close. Unverified rows must not enter AI performance statistics.",
  };
}
