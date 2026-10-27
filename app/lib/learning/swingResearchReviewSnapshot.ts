import pool from "@/app/lib/postgres";
import { assessResearchEvidence, type EvidenceSnapshot } from "@/app/lib/learning/researchApprovalGate";

// Read-only candidate from the actual frozen swing observation table.
// Provenance / license / independent timestamps / holdout / regime labels are
// NOT present in these rows. Those flags must remain false until audited.
export async function getSwingResearchReviewSnapshot() {
  const result = await pool.query<{
    recorded:string; evaluated:string; distinct_days:string;
    completed_months:string; avg_5d:string|null; median_5d:string|null; up_5d:string;
  }>(`SELECT COUNT(*)::text AS recorded,
    COUNT(return_5d)::text AS evaluated,
    COUNT(DISTINCT trade_date)::text AS distinct_days,
    COUNT(DISTINCT date_trunc('month', trade_date))::text AS completed_months,
    ROUND(AVG(return_5d),4)::text AS avg_5d,
    percentile_cont(0.5) WITHIN GROUP(ORDER BY return_5d)::text AS median_5d,
    COUNT(*) FILTER(WHERE return_5d>0)::text AS up_5d
    FROM public.swing_universe_observations WHERE rule_version=$1`,["ai_power_only_v1"]);
  const row=result.rows[0];
  const recorded=Number(row?.recorded??0);
  const evaluated=Number(row?.evaluated??0);
  const evidence:EvidenceSnapshot={
    researchId:"SWING_UNIVERSE_AI_POWER_ONLY",
    ruleVersion:"ai_power_only_v1",
    recorded,evaluated,
    distinctTradeDays:Number(row?.distinct_days??0),
    // Calendar months represented by data, NOT verified completed months.
    completedMonths:0,
    avgReturn5d:row?.avg_5d==null?null:Number(row.avg_5d),
    medianReturn5d:row?.median_5d==null?null:Number(row.median_5d),
    positiveRate5d:evaluated>0?Number(row.up_5d)/evaluated:null,
    marketRegimes:[],
    sourceVerified:false,licenseVerified:false,
    independentTimestampsVerified:false,holdoutVerified:false
  };
  return {evidence, observedMonths:Number(row?.completed_months??0),
    decision:assessResearchEvidence(evidence),
    reviewRecord:null, productionApplied:false, notificationEnabled:false,
    source:"READ_ONLY_FROZEN_SWING_OBSERVATIONS" as const};
}
