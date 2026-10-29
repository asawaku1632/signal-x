/** Sixth-stage proposal review. PURE OFFLINE: never writes to production or activates signals. */
import {reviewFiveStageResearch} from "./fiveStageResearchGate.mjs";
import {auditPredecisionEvidence} from "./predecisionEvidenceAudit.mjs";

const validDate=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
export function reviewSixStagePromotion({findings=[],snapshots=[],comparisons=[],evidence=[],cutoffUtc="2026-10-29T00:05:00Z"}={}){
 const previous=reviewFiveStageResearch({findings,snapshots,comparisons});
 const provenance=auditPredecisionEvidence(evidence,{cutoffUtc});
 // Each comparison must match an independently anchored forward experiment ID
 // supplied in both a recorded predecision snapshot and the subsequent outcome.
 const snapKeys=new Set(snapshots.filter(x=>validDate(x?.tradeDate)&&
   typeof x?.experimentId==="string"&&x.experimentId.length>0&&
   x?.sourceVerified===true&&x?.independentTimeAttestation===true&&
   x?.outcomeNotYetKnown===true&&typeof x.recordedAt==="string"&&
   /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x.recordedAt)&&
   Number.isFinite(Date.parse(x.recordedAt))&&Date.parse(x.recordedAt)<Date.parse(x.tradeDate+"T09:05:00+09:00"))
   .map(x=>x.experimentId+"|"+x.tradeDate));
 const eligible=comparisons.filter(x=>validDate(x?.tradeDate)&&typeof x?.experimentId==="string"&&
   snapKeys.has(x.experimentId+"|"+x.tradeDate)&&
   x.outcomeSourceVerified===true&&Number.isFinite(x.baselineReturn)&&
   Number.isFinite(x.candidateReturn)&&Number.isFinite(x.benchmarkReturn));
 const seen=new Set(),duplicates=new Set();
 for(const x of eligible){const key=x.experimentId+"|"+x.tradeDate;if(seen.has(key))duplicates.add(key);seen.add(key);}
 const unique=eligible.filter(x=>!duplicates.has(x.experimentId+"|"+x.tradeDate));
 const byDate=new Map();
 for(const x of unique){const group=byDate.get(x.tradeDate)??[];group.push(x);byDate.set(x.tradeDate,group);}
 const daily=[...byDate].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,rows])=>({
  date,baseline:mean(rows.map(r=>r.baselineReturn)),candidate:mean(rows.map(r=>r.candidateReturn)),
  benchmark:mean(rows.map(r=>r.benchmarkReturn))}));
 const gaps=daily.map(x=>x.candidate-x.baseline);
 const forwardMonths=new Set(daily.map(x=>x.date.slice(0,7))).size;
 const warnings=[];
 if(provenance.independentlyValidated!==true)warnings.push("INDEPENDENT_SOURCE_ATTESTATION_MISSING");
 if(provenance.eligible===0)warnings.push("PREDECISION_EVIDENCE_MISSING");
 if(daily.length<20)warnings.push("FORWARD_DATES_LT_20");
 if(forwardMonths<3)warnings.push("FORWARD_MONTHS_LT_3");
 if(duplicates.size)warnings.push("DUPLICATE_EXPERIMENT_DATE");
 if(!daily.length||mean(gaps)<=0)warnings.push("NO_MEASURED_CANDIDATE_ADVANTAGE");
 warnings.push("HUMAN_PRODUCTION_REVIEW_NOT_PERFORMED");
 return {version:"SIX_STAGE_RESEARCH_PROPOSAL_V1",stages1to5:previous,
  stage6:{mode:"SHADOW_PROPOSAL_ONLY",comparisonDates:daily.length,comparisonMonths:forwardMonths,
   uniqueExperimentDatePairs:unique.length,duplicateExperimentDatePairs:duplicates.size,
   pairedDateMeanGap:mean(gaps),positiveGapDates:gaps.filter(x=>x>0).length,
   largestDailyDrawdownProxy:daily.length?Math.min(...daily.map(x=>x.candidate)):null,
   rejectedUnanchoredComparisonRows:comparisons.length-eligible.length,
   evidenceReceived:provenance.received,evidenceStructurallyEligible:provenance.eligible,
   blockers:warnings,decision:"DO_NOT_PROMOTE",independentlyValidated:false},
  approvalRequired:true,productionChanged:false,trainingEnabled:false,
  rankingsChanged:false,notificationsEnabled:false,tradingEnabled:false};
}
