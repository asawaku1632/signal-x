import { buildGeneratedScanResearchEnvelope } from "./buildGeneratedScanResearchEnvelope.mjs";
import { saveResearchScanCaptureDev } from "./saveResearchScanCaptureDev.mjs";
import { planScanResearchIntake } from "./planScanResearchIntake.mjs";

// Explicit development-only ingestion entry point. Never used by live Scan.
// Requires a caller-supplied generated payload and the dev writer's existing
// host, environment, and quarantine checks. No automatic refresh or scoring.
export async function ingestGeneratedScanIntoResearchDev(client, input) {
  const generated = buildGeneratedScanResearchEnvelope(input);
  if (!generated.accepted) return {
    accepted: false, reason: generated.reason, inserted: 0,
    persisted: false, promoted: false
  };
  // Refuse an entire run if any observation is invalid or duplicated. This
  // prevents incomplete real-world Scan runs being silently stored as complete.
  const plan = planScanResearchIntake(input);
  if (!plan.valid_for_storage || plan.blocked_count > 0 || plan.candidate_count !== plan.total_observations) {
    return { accepted:false, reason:"INCOMPLETE_OR_UNSAFE_RESEARCH_RUN",
      attempted:plan.total_observations, blocked:plan.blocked_count,
      blocked_reasons:plan.blocked_reasons, inserted:0, persisted:false, promoted:false };
  }
  const summary = await saveResearchScanCaptureDev(client, generated.envelope);
  return {
    accepted: true, reason: "QUARANTINED_DEV_CAPTURE",
    ...summary, persisted: summary.inserted > 0, promoted: false
  };
}
