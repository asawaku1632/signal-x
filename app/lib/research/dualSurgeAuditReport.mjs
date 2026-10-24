// Pure, research-only reproducibility and reconciliation helpers.
// No provider fetch, persistence, notifications, trading or production route calls.
import {validateLedger,overlapFlags} from "./dualSurgeQualityGates.mjs";
import {maturityTable} from "./dualSurgePreflight.mjs";
export const AUDIT_VERSION="DUAL_SURGE_AUDIT_V1";
export function reconcileBaseline(ledger,baseline){
 validateLedger(ledger);
 if(!baseline||["independentFirstEvents","maturedFiveSession","pendingFiveSession","positiveFiveSession","negativeFiveSession"].some(k=>!Number.isSafeInteger(baseline[k])||baseline[k]<0)||baseline.maturedFiveSession+baseline.pendingFiveSession>baseline.independentFirstEvents||baseline.positiveFiveSession+baseline.negativeFiveSession>baseline.maturedFiveSession)throw Error("INVALID_BASELINE");
 const counts={events:ledger.length,matured:0,pending:0,excluded:0,positive:0,negative:0,flat:0};
 for(const e of ledger){
  const outcome=e.outcomes[5].legacyCloseToClose;
  if(outcome.status==="MATURED"){
   counts.matured++;
   if(outcome.returnPct>0)counts.positive++;
   else if(outcome.returnPct<0)counts.negative++;
   else counts.flat++;
  }else if(outcome.status==="PENDING")counts.pending++;
  else counts.excluded++;
 }
 const expected={events:baseline.independentFirstEvents,matured:baseline.maturedFiveSession,pending:baseline.pendingFiveSession,
  positive:baseline.positiveFiveSession,negative:baseline.negativeFiveSession};
 const mismatches=Object.entries(expected).filter(([k,v])=>counts[k]!==v).map(([field,expectedValue])=>({field,expected:expectedValue,actual:counts[field]}));
 return {version:AUDIT_VERSION,counts,expected,mismatches,reconciled:mismatches.length===0&&counts.excluded===0,
  note:"Matching aggregate counts is necessary but not sufficient for per-event reproducibility."};
}
export function buildAuditReport({ledger,baseline,studyId}){
 if(typeof studyId!=="string"||!studyId.trim())throw Error("INVALID_STUDY_ID");
 const reconciliation=reconcileBaseline(ledger,baseline);
 const overlaps=overlapFlags(ledger,5);
 const maturity=maturityTable(ledger);
 return {version:AUDIT_VERSION,studyId,readOnly:true,deterministic:true,providerRequests:0,
  eventCount:ledger.length,reconciliation,
  overlap:{flagged:overlaps.filter(x=>x.overlappingSameStock).length,events:overlaps},
  maturity,
  gates:{aggregateReconciled:reconciliation.reconciled,
   noOverlap:overlaps.every(x=>!x.overlappingSameStock),
   sufficientMaturedSample:reconciliation.counts.matured>=30,
   approvedForProduction:false},
  warnings:["Aggregate reconciliation does not prove event-level identity.",
   "Overlapping event windows are not independent observations.",
   "Historical gross price proxies are not executable returns or predictive win rates."]};
}
