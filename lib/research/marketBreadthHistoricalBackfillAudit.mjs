// Shadow-only provenance audit. A later DB insertion cannot prove an earlier prediction.
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function auditMarketBreadthHistoricalBackfill({records=[]}={}){
 if(!Array.isArray(records)||records.length>100000)throw new TypeError('INVALID_BACKFILL_RECORDS');
 const counts={total:records.length,afterTradeDate:0,onTradeDate:0,beforeTradeDate:0,invalid:0,independentGenerationProof:0};
 const quarantined=[];
 for(let i=0;i<records.length;i++){
  const x=records[i],ts=typeof x?.createdAt==='string'?Date.parse(x.createdAt):NaN;
  if(!validDay(x?.tradeDate)||!Number.isFinite(ts)){counts.invalid++;quarantined.push({index:i,reason:'INVALID_DATE_OR_TIMESTAMP'});continue}
  const createdDay=new Date(ts).toISOString().slice(0,10);
  if(createdDay>x.tradeDate){counts.afterTradeDate++;quarantined.push({index:i,reason:'POST_DATE_INSERTION_CANNOT_PROVE_ORIGINAL_SIGNAL'});}
  else if(createdDay===x.tradeDate){counts.onTradeDate++;quarantined.push({index:i,reason:'SAME_DAY_INSERTION_NEEDS_SOURCE_ATTESTATION'});}
  else {counts.beforeTradeDate++;quarantined.push({index:i,reason:'PRE_DATE_INSERTION_NEEDS_SOURCE_ATTESTATION'});}
 }
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,counts,
  independentlyVerifiedProspectiveSignals:0,independentImprovementVerified:false,quarantined,
  limitations:['CREATED_AT_IS_INSERTION_TIME_NOT_GENERATION_PROOF','UTC_DATE_COMPARISON_IS_DESCRIPTIVE','INDEPENDENT_IMMUTABLE_GENERATION_ATTESTATION_REQUIRED','NO_MODEL_PROMOTION']};
}
