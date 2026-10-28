// Descriptive statistical readiness only; no performance claim or model promotion.
export function assessMarketBreadthStatisticalReadiness({observations=[],minSignals=100,minTradeDates=20,minMonths=3}={}){
 if(!Array.isArray(observations)||observations.length>100000)throw new TypeError('INVALID_STATISTICAL_OBSERVATIONS');
 const valid=[],rejected=[];
 for(let index=0;index<observations.length;index++){
  const x=observations[index];
  if(!x||typeof x.signalRecordId!=='string'||typeof x.tradeDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.tradeDate)||!Number.isFinite(Date.parse(x.tradeDate+'T00:00:00Z'))||new Date(x.tradeDate+'T00:00:00Z').toISOString().slice(0,10)!==x.tradeDate||typeof x.fiveSessionReturnPercent!=='number'||!Number.isFinite(x.fiveSessionReturnPercent)||x.independentlyAudited!==true){rejected.push({index,reason:'UNVERIFIED_OR_INVALID_OUTCOME'});continue}
  valid.push(x);
 }
 const ids=new Set(),duplicates=new Set();
 for(const x of valid){if(ids.has(x.signalRecordId))duplicates.add(x.signalRecordId);ids.add(x.signalRecordId)}
 const clean=valid.filter(x=>!duplicates.has(x.signalRecordId));
 const sorted=clean.map(x=>x.fiveSessionReturnPercent).sort((a,b)=>a-b);
 const n=sorted.length,mean=n?sorted.reduce((a,b)=>a+b,0)/n:null;
 const median=n?(sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2:null;
 const positiveRate=n?clean.filter(x=>x.fiveSessionReturnPercent>0).length/n:null;
 const dates=new Set(clean.map(x=>x.tradeDate)),months=new Set(clean.map(x=>x.tradeDate.slice(0,7)));
 const thresholdsMet=n>=minSignals&&dates.size>=minTradeDates&&months.size>=minMonths;
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,statisticallyReadyForIndependentReview:thresholdsMet,
  counts:{submitted:observations.length,valid:n,rejected:rejected.length,duplicateQuarantined:valid.length-n,tradeDates:dates.size,months:months.size},
  metrics:{meanFiveSessionReturnPercent:mean,medianFiveSessionReturnPercent:median,positiveRate},
  missing:[...(n<minSignals?['MIN_SIGNALS']:[]),...(dates.size<minTradeDates?['MIN_TRADE_DATES']:[]),...(months.size<minMonths?['MIN_MONTHS']:[]),'MARKET_REGIME_REPLICATION','OUT_OF_SAMPLE_COMPARISON','AUDITOR_AUTHORITY_REVIEW'],rejected};
}
