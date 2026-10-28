import { compareForwardResults } from "./compareForwardResults.mjs";

// Research-only descriptive calibration. Never interprets sparse results as
// investable signal; no training, threshold changes or production writes.
export function describeVerifiedAiPowerBands(captures, outcomes) {
  if (!Array.isArray(captures) || !Array.isArray(outcomes))
    throw new TypeError("INVALID_RESEARCH_INPUT");
  const compared = compareForwardResults(captures, outcomes);
  const bands = [
    { label:"0-39", min:0, max:40 },
    { label:"40-59", min:40, max:60 },
    { label:"60-79", min:60, max:80 },
    { label:"80-100", min:80, max:101 }
  ].map(({label,min,max})=>{
    const rows=compared.accepted.filter(x=>x.ai_power>=min && x.ai_power<max);
    const sorted=rows.map(x=>x.return_pct).sort((a,b)=>a-b);
    const n=sorted.length;
    const median=n ? (sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2 : null;
    const keys = new Set(rows.map(x => x.code));
    const runs = new Set(rows.map(x => x.scan_run_id));
    return {band:label,verified_count:n,distinct_codes:keys.size,distinct_runs:runs.size,mean_return_pct:n?sorted.reduce((a,b)=>a+b,0)/n:null,
      median_return_pct:median,positive_rate_pct:n?100*sorted.filter(x=>x>0).length/n:null};
  });
  return {
    status: compared.accepted.length?"DESCRIPTIVE_RESEARCH_ONLY":"NO_INDEPENDENTLY_VERIFIED_OUTCOMES",
    accepted_count:compared.accepted.length,rejected_count:compared.rejected.length,
    bands,eligible_for_live_ai:false,threshold_change_authorized:false,
    rejected:compared.rejected
  };
}
