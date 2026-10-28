// Read-only evidence readiness. Historical record counts cannot unlock forward research.
export function assessMarketBreadthEvidenceReadiness(review,{licensedBreadthCount=0,independentlyTimestampedSignals=0,verifiedFiveSessionOutcomes=0}={}){
 const count=x=>Number.isSafeInteger(x)&&x>=0;
 if(!review||review.schemaVersion!=='market-breadth-legacy-review-v1'||
  review.researchOnly!==true||review.forwardEvidenceEligible!==false||
  !review.inventory||!count(review.inventory.signalCount)||!count(review.inventory.resultCount)||
  !count(review.fiveDayLinkedUnverified)||
  !count(licensedBreadthCount)||!count(independentlyTimestampedSignals)||!count(verifiedFiveSessionOutcomes))throw new TypeError('INVALID_EVIDENCE_READINESS_INPUT');
 const missing=[];
 if(independentlyTimestampedSignals===0)missing.push('INDEPENDENT_SIGNAL_PROVENANCE_MISSING');
 if(licensedBreadthCount===0)missing.push('LICENSED_MARKET_BREADTH_MISSING');
 if(verifiedFiveSessionOutcomes===0)missing.push('VERIFIED_FIVE_SESSION_OUTCOMES_MISSING');
 // These are coverage indicators, not cross-record joins or permission to promote.
 return {schemaVersion:'market-breadth-evidence-readiness-v1',researchOnly:true,
  productionEligible:false,notificationEligible:false,automatedPromotionEligible:false,
  sourceInventory:{historicalSignals:review.inventory.signalCount,historicalResults:review.inventory.resultCount,
   legacyFiveDayLinkedUnverified:review.fiveDayLinkedUnverified},
  independentlyTimestampedSignals,licensedBreadthCount,verifiedFiveSessionOutcomes,
  missing,coveragePresent:missing.length===0,
  researchCohortEligible:false,
  nextAction:missing.length?'Resolve missing independent provenance, licensed breadth and five-session outcomes.':'Run row-level chronology, license and unique-source evidence joins; aggregate coverage is not approval.'};
}
