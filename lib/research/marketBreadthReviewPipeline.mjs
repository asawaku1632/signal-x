// Research-only, deterministic, read-only pipeline. No external I/O.
import {auditMarketBreadthEvidence} from './marketBreadthEvidenceAudit.mjs';
import {summarizeBreadthResearchCohorts} from './marketBreadthCohortSummary.mjs';
import {buildMarketBreadthResearchReport} from './marketBreadthResearchReport.mjs';
export function runMarketBreadthResearchReview(rows,resolveEvidence,{generatedAt,minPerCohort=30,minDates=10}={}){
 const audit=auditMarketBreadthEvidence(rows,resolveEvidence);
 // Cohorts are derived solely from the evidence gate, never from raw input rows.
 const verified=audit.accepted.map(r=>({...r,eligible:true}));
 const cohorts=summarizeBreadthResearchCohorts(verified,{minPerCohort,minDates});
 const report=buildMarketBreadthResearchReport({audit,cohorts,generatedAt});
 return {researchOnly:true,productionEligible:false,audit,cohorts,report,
  provenance:audit.provenance.map(item=>({...item}))};
}
