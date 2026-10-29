// Descriptive, shadow-only score/forward-return relationship on audited legacy rows.
// Not a model, a trade recommendation, or independent evidence of improvement.
export function evaluateLegacyScoreBands({audit,cutoff=85,minimumDates=5}={}){
 if(!audit||audit.researchOnly!==true||audit.aiPromotionAuthorized!==false||!Array.isArray(audit.accepted))throw new TypeError('REQUIRES_SHADOW_AUDIT');
 if(!Number.isFinite(cutoff)||cutoff<0||cutoff>100||!Number.isInteger(minimumDates)||minimumDates<1)throw new TypeError('INVALID_DIAGNOSTIC_OPTIONS');
 const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 const seen=new Set();
 for(const r of audit.accepted){
  if(!r||!validDate(r.date)||!validDate(r.evaluatedTradeDate)||r.evaluatedTradeDate<=r.date||typeof r.code!=='string'||!r.code||!Number.isFinite(r.score)||r.score<0||r.score>100||!Number.isFinite(r.changePercent)||r.changePercent< -100)throw new TypeError('INVALID_AUDITED_ROW');
  const key=JSON.stringify([r.date,r.code]);if(seen.has(key))throw new TypeError('DUPLICATE_AUDITED_STOCK_DATE');seen.add(key);
 }
 const high=audit.accepted.filter(r=>r.score>=cutoff),low=audit.accepted.filter(r=>r.score<cutoff);
 const summarize=rows=>{
  const groups=new Map();for(const r of rows){const g=groups.get(r.date)||{sum:0,count:0};g.sum+=r.changePercent;g.count++;groups.set(r.date,g)}
  const daily=[...groups.values()].map(g=>g.sum/g.count);
  return {observations:rows.length,distinctDates:groups.size,meanReturnPercent:rows.length?rows.reduce((s,r)=>s+r.changePercent,0)/rows.length:null,equalDateMeanReturnPercent:daily.length?daily.reduce((a,b)=>a+b,0)/daily.length:null,positiveRate:rows.length?rows.filter(r=>r.changePercent>0).length/rows.length:null};
 };
 const highSummary=summarize(high),lowSummary=summarize(low);
 const pairedDates=[...new Set(high.map(r=>r.date))].filter(d=>low.some(r=>r.date===d)).sort();
 const dateMean=(rows,date)=>{const v=rows.filter(r=>r.date===date);return v.reduce((s,r)=>s+r.changePercent,0)/v.length};
 const spreads=pairedDates.map(d=>dateMean(high,d)-dateMean(low,d));
 const positiveSpreadDates=spreads.filter(x=>x>0).length;
 const negativeSpreadDates=spreads.filter(x=>x<0).length;
 const tiedSpreadDates=spreads.length-positiveSpreadDates-negativeSpreadDates;
 const sortedSpreads=[...spreads].sort((a,b)=>a-b);
 const medianSpread=sortedSpreads.length?(sortedSpreads[Math.floor((sortedSpreads.length-1)/2)]+sortedSpreads[Math.floor(sortedSpreads.length/2)])/2:null;
 const leaveOneDateOutSpreads=spreads.length>1?spreads.map((_,i)=>(spreads.reduce((a,b)=>a+b,0)-spreads[i])/(spreads.length-1)):[];
 const leaveOneDateOutMinSpreadPercent=leaveOneDateOutSpreads.length?Math.min(...leaveOneDateOutSpreads):null;
 const leaveOneDateOutMaxSpreadPercent=leaveOneDateOutSpreads.length?Math.max(...leaveOneDateOutSpreads):null;
 const reasons=['NO_FROZEN_BASELINE','NO_INDEPENDENT_PRICE_ATTESTATION','NO_TRANSACTION_COSTS','DESCRIPTIVE_ASSOCIATION_ONLY'];
 if(pairedDates.length<minimumDates)reasons.push('INSUFFICIENT_PAIRED_DATES');
 if(audit.counts?.quarantined||audit.counts?.rejected)reasons.push('EXCLUDED_UNVERIFIED_ROWS');
 return {researchOnly:true,productionEligible:false,aiPromotionAuthorized:false,independentImprovementVerified:false,cutoff,high:highSummary,low:lowSummary,pairedDates:pairedDates.length,pairedDateMeanSpreadPercent:spreads.length?spreads.reduce((a,b)=>a+b,0)/spreads.length:null,pairedDateMedianSpreadPercent:medianSpread,positiveSpreadDates,negativeSpreadDates,tiedSpreadDates,positiveSpreadDateRate:spreads.length?positiveSpreadDates/spreads.length:null,leaveOneDateOutMinSpreadPercent,leaveOneDateOutMaxSpreadPercent,allLeaveOneDateOutSpreadsPositive:leaveOneDateOutSpreads.length?leaveOneDateOutSpreads.every(v=>v>0):null,diagnosticEligible:pairedDates.length>=minimumDates,reasons};
}
