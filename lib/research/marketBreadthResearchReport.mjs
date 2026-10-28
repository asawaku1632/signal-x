// Research-only display model. No DB, route, notification, or trade decision integration.
export function buildMarketBreadthResearchReport({audit,cohorts,generatedAt}={}){
 const rejected=audit?.rejectionCounts??{},cohortRejects=cohorts?.rejectionCounts??{};
 const validTime=typeof generatedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(generatedAt)&&Number.isFinite(Date.parse(generatedAt));
 const number=x=>Number.isInteger(x)&&x>=0?x:0;
 const safeGroup=g=>({n:number(g?.n),uniqueDates:number(g?.uniqueDates),uniqueSymbols:number(g?.uniqueSymbols),
 mean5dPct:typeof g?.mean5dPct==='number'&&Number.isFinite(g.mean5dPct)?g.mean5dPct:null,
 median5dPct:typeof g?.median5dPct==='number'&&Number.isFinite(g.median5dPct)?g.median5dPct:null,
 positiveRate:typeof g?.positiveRate==='number'&&Number.isFinite(g.positiveRate)&&g.positiveRate>=0&&g.positiveRate<=1?g.positiveRate:null});
 const divergence=safeGroup(cohorts?.divergence),other=safeGroup(cohorts?.other);
 const eligible=cohorts?.comparisonReady===true&&audit?.acceptedCount===divergence.n+other.n&&
  divergence.n>=30&&other.n>=30&&divergence.uniqueDates>=10&&other.uniqueDates>=10&&
  divergence.uniqueSymbols>0&&other.uniqueSymbols>0&&
  [divergence.mean5dPct,other.mean5dPct,divergence.median5dPct,other.median5dPct,
   divergence.positiveRate,other.positiveRate].every(x=>x!==null);
 const reasons={};
 for(const source of [rejected,cohortRejects])for(const [k,v] of Object.entries(source)){
  if(/^[A-Z_]+$/.test(k)&&Number.isInteger(v)&&v>=0)reasons[k]=(reasons[k]??0)+v;
 }
 const missing={divergenceObservations:Math.max(0,30-divergence.n),otherObservations:Math.max(0,30-other.n),
  divergenceTradingDays:Math.max(0,10-divergence.uniqueDates),otherTradingDays:Math.max(0,10-other.uniqueDates)};
 return {schemaVersion:'market-breadth-research-report-v1',researchOnly:true,productionEligible:false,
 generatedAt:validTime?generatedAt:null,status:eligible?'DESCRIPTIVE_COMPARISON_READY':'INSUFFICIENT_VERIFIED_EVIDENCE',
 acceptedEvidenceCount:number(audit?.acceptedCount),rejectedEvidenceCount:number(audit?.rejectedCount),
 divergence,other,rejectionCounts:reasons,minimumEvidenceShortfall:missing,
 deltaMean5dPct:eligible&&typeof cohorts?.deltaMean5dPct==='number'&&Number.isFinite(cohorts.deltaMean5dPct)?cohorts.deltaMean5dPct:null,
 note:'Descriptive research only. No trading advice, statistical significance, or production eligibility.'};
}
