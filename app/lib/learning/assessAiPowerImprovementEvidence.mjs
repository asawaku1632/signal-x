import { summarizeVerifiedForwardResearch } from "./summarizeVerifiedForwardResearch.mjs";
import { describeVerifiedAiPowerBands } from "./describeVerifiedAiPowerBands.mjs";

// Research-only gate for deciding whether an experiment is even ready for
// human assessment. Thresholds are conservative review triggers, not a
// statistical proof of predictive accuracy or an authorization to change AI.
export function assessAiPowerImprovementEvidence(captures, outcomes) {
  const summary = summarizeVerifiedForwardResearch(captures, outcomes);
  const cohorts = describeVerifiedAiPowerBands(captures, outcomes);
  const reasons=[];
  if (summary.accepted === 0) reasons.push("NO_INDEPENDENTLY_VERIFIED_FORWARD_RESULTS");
  if (summary.accepted < 100) reasons.push("FEWER_THAN_100_VERIFIED_OUTCOMES");
  if (summary.distinct_codes < 30) reasons.push("FEWER_THAN_30_DISTINCT_STOCKS");
  if (summary.distinct_prediction_sessions < 20) reasons.push("FEWER_THAN_20_PREDICTION_SESSIONS");
  if (summary.distinct_prediction_months < 3) reasons.push("FEWER_THAN_3_PREDICTION_MONTHS");
  const upper=cohorts.bands.find(b=>b.band==="80-100");
  const lower=cohorts.bands.find(b=>b.band==="40-59");
  if (!upper || !lower || upper.verified_count < 20 || lower.verified_count < 20)
    reasons.push("INSUFFICIENT_HIGH_LOW_SCORE_COMPARISON");
  if (cohorts.bands.some(b=>b.verified_count>0 && b.largest_code_share_pct>25))
    reasons.push("SINGLE_STOCK_CONCENTRATION");
  // Distinct runs and stocks alone do not establish independent temporal replication.
  // Require the separate out-of-sample evaluation to be explicitly reviewed.
  if (summary.accepted > 0) reasons.push("OUT_OF_SAMPLE_REPLICATION_NOT_EVALUATED");
  // Even if all these heuristics pass, license, temporal out-of-sample validation,
  // uncertainty intervals and manual review are independent requirements.
  return {
    status:reasons.length?"NOT_READY_FOR_HUMAN_EFFECT_REVIEW":"BASIC_COVERAGE_ONLY",
    reasons,coverage: {
      verified_outcomes:summary.accepted,distinct_stocks:summary.distinct_codes,
      prediction_sessions:summary.distinct_prediction_sessions,
      prediction_months:summary.distinct_prediction_months
    },
    bands:cohorts.bands,
    effect_established:false,eligible_for_live_ai:false,
    automatic_learning_allowed:false,requires_independent_review:true
  };
}
