import { compareForwardResults } from "./compareForwardResults.mjs";

// Read-only research report. Does not train, rank, promote, notify, or write.
// Results are descriptive, not an estimate of future win probability.
export function summarizeVerifiedForwardResearch(captures, outcomes) {
  if (!Array.isArray(captures) || !Array.isArray(outcomes))
    throw new TypeError("INVALID_RESEARCH_INPUT");
  const comparison = compareForwardResults(captures, outcomes);
  const values = comparison.accepted.map(x => x.return_pct).sort((a,b)=>a-b);
  const count = values.length;
  const sum = values.reduce((total,x)=>total+x,0);
  const median = count === 0 ? null : count % 2
    ? values[(count-1)/2] : (values[count/2-1]+values[count/2])/2;
  const rejectionReasons = {};
  for (const item of comparison.rejected)
    rejectionReasons[item.reason] = (rejectionReasons[item.reason] ?? 0)+1;
  const distinctCodes = new Set(comparison.accepted.map(x=>x.code)).size;
  const distinctRuns = new Set(comparison.accepted.map(x=>x.scan_run_id)).size;
  const dateInJst = value => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit"
    }).formatToParts(new Date(value));
    const fields = Object.fromEntries(parts.map(p=>[p.type,p.value]));
    return `${fields.year}-${fields.month}-${fields.day}`;
  };
  const acceptedRunIds = new Set(comparison.accepted.map(x=>JSON.stringify([x.scan_run_id,x.code])));
  const sessions = new Set(captures.filter(c=>acceptedRunIds.has(JSON.stringify([c?.scan_run_id,c?.code]))).map(c=>dateInJst(c.scan_received_at)));
  const months = new Set([...sessions].map(date=>date.slice(0,7)));
  return {
    status: count ? "DESCRIPTIVE_RESEARCH_ONLY" : "INSUFFICIENT_VERIFIED_DATA",
    reviewed: captures.length,
    accepted: count,
    rejected: comparison.rejected.length,
    distinct_codes: distinctCodes,
    distinct_runs: distinctRuns,
    distinct_prediction_sessions: sessions.size,
    distinct_prediction_months: months.size,
    sample_adequacy_assessed: false,
    mean_return_pct: count ? sum/count : null,
    median_return_pct: median,
    positive_rate_pct: count ? values.filter(v=>v>0).length/count*100 : null,
    rejection_reasons: rejectionReasons,
    eligible_for_live_ai: false,
    // Preserve independently reviewable accepted/rejected cases.
    comparison
  };
}
