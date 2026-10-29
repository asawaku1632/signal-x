/** Offline research-use tiers; no source assertion can authenticate itself. */
const good=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
export function classifyResearchUse(rows){
 if(!Array.isArray(rows))throw Error("INVALID_RESEARCH_USE_ROWS");
 const summary={referenceResearch:0,needsReview:0,strictCandidate:0};
 const results=rows.map((r,i)=>{
  let tier="needsReview",reason="INVALID_OR_MISSING_PRICE";
  if(r&&good(r.price)&&good(r.nextPrice)){
   tier="referenceResearch";reason="PRICE_PAIR_ONLY";
   if(r.sourceLinked===true){tier="needsReview";reason="LINKED_SOURCE_REQUIRES_INDEPENDENT_AUDIT";}
   if(r.priorAsOfDocumented===true&&r.sourceLinked===true&&r.priorEvidenceVerified===true&&r.outcomeProvenanceVerified===true){
    tier="strictCandidate";reason="ASSERTED_EVIDENCE_PENDING_EXTERNAL_AUTHENTICATION";
   }
  }
  summary[tier]++;
  return {index:i,tier,reason,independentlyVerified:false};
 });
 return {version:"RESEARCH_USE_TIERS_V1",summary,results,strictVerified:0,
 warning:"Strict candidate is not verified or trading-ready; caller assertions and source links require independent checking."};
}
