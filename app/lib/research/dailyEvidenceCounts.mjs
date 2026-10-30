/** Pure reconciliation of aggregate counts from independently run SELECTs.
 * Descriptive only: no row provenance verification or live signaling.
 */
export function reconcileDailyEvidenceCounts(x){
 const keys=["total","paired","traced","tracedPaired","savedBeforeDay"];
 if(!x||keys.some(k=>!Number.isSafeInteger(x[k])||x[k]<0))throw Error("INVALID_EVIDENCE_COUNTS");
 const {total,paired,traced,tracedPaired,savedBeforeDay}=x;
 if(paired>total||traced>total||tracedPaired>Math.min(paired,traced)||savedBeforeDay>total)
  throw Error("INCONSISTENT_EVIDENCE_COUNTS");
 return {version:"DAILY_EVIDENCE_COUNT_AUDIT_V1",total,paired,traced,tracedPaired,
  missingPaired:total-paired,untraced:total-traced,
  pairedButUntraced:paired-tracedPaired,
  savedBeforeDay,coveragePct:total?Number((100*traced/total).toFixed(2)):null,
  independentlyVerified:false,shadowOnly:true,
  warning:"Aggregate coverage does not establish immutable pre-decision features, provider rights, correct price dates, or predictive performance."};
}
