import { adaptJQuantsV2DailyBars } from "./jquantsDailyBarAdapter.mjs";
import { validateJQuantsDailyResearchBatch } from "./jquantsDailyBatchGate.mjs";
import { evaluateOfficialCloseBaseline } from "./dailyOfficialCloseBaseline.mjs";

/**
 * Offline only. No credentials, database, or network access.
 * The batch gate MUST pass before forward outcomes can be computed.
 * certification is an explicit, external research review decision, not
 * something this code can derive from a successful API response.
 */
export function runGatedJQuantsForwardResearch({
  signals, jquantsPayload, verifiedSessions, expectedCodes,
  certifiedComparable = false,
}) {
  if (!Array.isArray(signals)) throw new TypeError("signals must be an array");
  const dailyCloses = adaptJQuantsV2DailyBars(jquantsPayload, { certifiedComparable });
  const gate = validateJQuantsDailyResearchBatch({
    rows: dailyCloses, sessions: verifiedSessions, expectedCodes,
  });
  if (!gate.accepted) {
    return {
      mode: "OFFLINE_RESEARCH_ONLY",
      status: "BLOCKED_DATA_QUALITY",
      gate,
      rows: [],
      summary: [],
      warning: "No performance metrics were computed because daily data quality or price-basis verification failed.",
    };
  }
  const outcome = evaluateOfficialCloseBaseline({
    signals, dailyCloses, verifiedSessions,
  });
  return { status: "EVALUATED", gate, ...outcome };
}
