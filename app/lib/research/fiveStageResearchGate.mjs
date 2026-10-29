/** Research-only five-stage gate; no database writes, no notification or deployment. */
export function reviewFiveStageResearch({findings=[],snapshots=[],comparisons=[]}={}){
 if(!Array.isArray(findings)||!Array.isArray(snapshots)||!Array.isArray(comparisons))throw Error("INVALID_FIVE_STAGE_INPUT");
 const categories=["AI_POWER","PRICE_BAND","SCORE_DELTA","REPEATED_CODE","MARKET_REGIME"];
 const inventory=categories.map(category=>{
  const group=findings.filter(x=>x?.category===category);
  return {category,studies:group.length,
   classification:group.length===0?"DATA_MISSING":group.some(x=>x.independentlyVerified!==true)?"EXPLORATORY_ONLY":"REQUIRES_FORWARD_VALIDATION"};
 });
 const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
 const validSnapshots=snapshots.filter(x=>date(x?.tradeDate)&&typeof x?.recordedAt==="string"&&Number.isFinite(Date.parse(x.recordedAt))&&
   Date.parse(x.recordedAt)<Date.parse(x.tradeDate+"T09:05:00+09:00")&&
   x.sourceVerified===true&&x.independentTimeAttestation===true&&x.outcomeNotYetKnown===true);
 const comparable=comparisons.filter(x=>date(x?.tradeDate)&&Number.isFinite(x?.baselineReturn)&&Number.isFinite(x?.candidateReturn)&&x.outcomeSourceVerified===true);
 const days=new Set(comparable.map(x=>x.tradeDate));
 const months=new Set([...days].map(x=>x.slice(0,7)));
 const daily=[...days].sort().map(d=>{const a=comparable.filter(x=>x.tradeDate===d);return {date:d,baselineMean:a.reduce((s,x)=>s+x.baselineReturn,0)/a.length,candidateMean:a.reduce((s,x)=>s+x.candidateReturn,0)/a.length};});
 const gaps=daily.map(x=>x.candidateMean-x.baselineMean),mean=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:null;
 const blockers=[];
 if(!validSnapshots.length)blockers.push("PREDECISION_AUTHENTICATED_SNAPSHOTS_MISSING");
 if(days.size<20)blockers.push("INSUFFICIENT_FORWARD_DATES");
 if(months.size<3)blockers.push("INSUFFICIENT_FORWARD_MONTHS");
 if(daily.length<2||mean(gaps)<=0)blockers.push("NO_REPRODUCED_IMPROVEMENT");
 blockers.push("INDEPENDENT_DEPLOYMENT_REVIEW_REQUIRED");
 return {version:"FIVE_STAGE_RESEARCH_SHADOW_V1",stage1:{inventory},stage2:{received:snapshots.length,structurallyQualified:validSnapshots.length,independentlyVerifiedByFunction:false},
 stage3:{weaknessesExploratory:findings.filter(x=>x?.independentlyVerified!==true).length},
 stage4:{comparedDates:days.size,months:months.size,equalDateMeanImprovement:mean(gaps),pairedComparisonOnly:true},
 stage5:{blockers,decision:"DO_NOT_DEPLOY"},trainingEnabled:false,notificationsEnabled:false,tradingEnabled:false,productionChanged:false};
}
