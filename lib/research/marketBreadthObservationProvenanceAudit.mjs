// Pure shadow-only chronology audit. A chronological timestamp is NOT independent proof of prediction provenance.
const time=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&/(Z|[+-]\d{2}:\d{2})$/.test(s);
const day=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function auditMarketBreadthObservationProvenance({rows=[]}={}){
 if(!Array.isArray(rows)||rows.length>100000)throw new TypeError('INVALID_PROVENANCE_ROWS');
 const accepted=[],rejected=[];
 for(let i=0;i<rows.length;i++){
  const r=rows[i];
  if(!r||!day(r.tradeDate)||!day(r.evaluatedTradeDate)||r.evaluatedTradeDate<=r.tradeDate||!time(r.barEndAt)||!time(r.snapshotSavedAt)||!time(r.evaluatedAt)||!Number.isFinite(r.returnPercent)||r.horizon!==5||r.horizonUnit!=='TRADING_DAY'){rejected.push({index:i,reason:'INVALID_ROW'});continue}
  const bar=Date.parse(r.barEndAt),saved=Date.parse(r.snapshotSavedAt),evaluated=Date.parse(r.evaluatedAt);
  if(saved<bar){rejected.push({index:i,reason:'SAVED_BEFORE_BAR_END'});continue}
  if(evaluated<=saved){rejected.push({index:i,reason:'EVALUATED_BEFORE_SNAPSHOT'});continue}
  const originalTimestampVerified=Boolean(r.originalSignalGeneratedAt&&time(r.originalSignalGeneratedAt)&&Date.parse(r.originalSignalGeneratedAt)<=saved&&Date.parse(r.originalSignalGeneratedAt)>=bar);
  accepted.push({index:i,tradeDate:r.tradeDate,evaluatedTradeDate:r.evaluatedTradeDate,chronologyPlausible:true,originalTimestampVerified:originalTimestampVerified===true,externalEvidenceVerified:false});
 }
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  counts:{submittedRows:rows.length,chronologicallyPlausible:accepted.length,rejectedRows:rejected.length,originalTimestampClaims:accepted.filter(x=>x.originalTimestampVerified).length,independentlyVerifiedPredictions:0},
  accepted,rejected,independentImprovementVerified:false,
  limitations:['TIMESTAMPS_ARE_SELF_REPORTED','SOURCE_PRICE_AND_LICENSE_UNVERIFIED','JST_TRADING_SESSION_CALENDAR_NOT_VERIFIED','NO_PRODUCTION_PROMOTION']};
}
