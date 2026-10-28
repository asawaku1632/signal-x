// Research-only readiness assessment. Never auto-activates production.
export function assessMarketBreadthPromotionReadiness(report,{minDates=20,minSymbols=30,minObservations=100}={}){
 const block=[];
 // Caller-supplied thresholds may tighten defaults, never bypass evidence floors.
 minDates=Number.isSafeInteger(minDates)?Math.max(20,minDates):20;
 minSymbols=Number.isSafeInteger(minSymbols)?Math.max(30,minSymbols):30;
 minObservations=Number.isSafeInteger(minObservations)?Math.max(100,minObservations):100;
 if(report?.researchOnly!==true||report?.productionEligible!==false)block.push('RESEARCH_BOUNDARY_NOT_PROVEN');
 if(report?.status!=='DESCRIPTIVE_COMPARISON_READY')block.push('COMPARISON_NOT_READY');
 if(report?.evidenceCountsReconciled!==true||report?.cohortCountsReconciled!==true)
  block.push('EVIDENCE_ACCOUNTING_NOT_RECONCILED');
 for(const [label,group] of [['DIVERGENCE',report?.divergence],['OTHER',report?.other]]){
  if(!group||!Number.isInteger(group.n)||group.n<minObservations||
   !Number.isInteger(group.uniqueDates)||group.uniqueDates<minDates||
   !Number.isInteger(group.uniqueSymbols)||group.uniqueSymbols<minSymbols)
   block.push(label+'_SAMPLE_INSUFFICIENT');
 }
 // Statistical significance, out-of-sample reproducibility and licensing cannot be
 // inferred from descriptive summaries. Require independent, later review.
 block.push('OUT_OF_SAMPLE_REPRODUCIBILITY_NOT_ATTESTED','INDEPENDENT_LICENSE_AUDIT_NOT_ATTESTED',
  'HUMAN_PRODUCTION_APPROVAL_REQUIRED');
 return {researchOnly:true,productionEligible:false,notificationEligible:false,
  readyForHumanResearchReview:block.length===3,blockers:block,
  evidenceCollectionReady:block.length===3,
  reviewScope:'DESCRIPTIVE_RESEARCH_ONLY',
  nextAction:'Continue licensed prospective collection and independent review. Never auto-promote.'};
}
