/**
 * Research-only decision rubric for pre-registered chronological holdouts.
 * This does NOT optimize, deploy, or update any production AI model.
 * An "improvement candidate" is a human-review queue, not proof of edge.
 */
export function classifyForwardResearchEvidence(holdoutRows, {
  minPerPeriod = 30,
  minCodesPerPeriod = 10,
  minDatesPerPeriod = 10,
  minPositiveRate = 0.55,
  minAverageReturnPct = 0,
} = {}) {
  if (!Array.isArray(holdoutRows)) throw new TypeError("holdoutRows must be an array");
  if (![minPerPeriod,minCodesPerPeriod,minDatesPerPeriod].every((n)=>Number.isSafeInteger(n)&&n>0)) throw new Error("invalid sample thresholds");
  if (!Number.isFinite(minPositiveRate)||minPositiveRate<0||minPositiveRate>1||
      !Number.isFinite(minAverageReturnPct)) throw new Error("invalid performance thresholds");
  return holdoutRows.map((r)=>{
    const old=r?.historical, future=r?.future;
    const enough=(p)=>p && Number.isSafeInteger(p.n) && p.n>=minPerPeriod &&
      Number.isSafeInteger(p.distinctCodes) && p.distinctCodes>=minCodesPerPeriod &&
      Number.isSafeInteger(p.distinctDates) && p.distinctDates>=minDatesPerPeriod &&
      typeof p.positiveRate==="number" && Number.isFinite(p.positiveRate) &&
      typeof p.averageReturnPct==="number" && Number.isFinite(p.averageReturnPct);
    const ready=r?.status==="DESCRIPTIVE_HOLDOUT_ONLY" && enough(old) && enough(future);
    let decision="HOLD",reason="INSUFFICIENT_INDEPENDENT_HOLDOUT_EVIDENCE";
    if (ready) {
      const good=(p)=>p.positiveRate>=minPositiveRate && p.averageReturnPct>minAverageReturnPct;
      if (good(old)&&good(future)) {
        decision="IMPROVEMENT_CANDIDATE";
        reason="DESCRIPTIVE_TREND_REPLICATED_HUMAN_REVIEW_REQUIRED";
      } else if (!good(old)&&!good(future)) {
        decision="NOT_ADOPTED";
        reason="DESCRIPTIVE_CRITERIA_NOT_MET_IN_EITHER_PERIOD";
      } else {
        decision="HOLD";
        reason="HISTORICAL_HOLDOUT_DISAGREE";
      }
    }
    return {
      horizon:r?.horizon??null,band:r?.band??null,
      decision,reason,autoApply:false,reviewRequired:true,
      note:"Descriptive research only. No causal, statistical significance, licensing, or live trading claims.",
    };
  });
}
