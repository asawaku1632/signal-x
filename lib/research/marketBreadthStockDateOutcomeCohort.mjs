// Pure, shadow-only stock-date deduplication of observed outcomes.
// Never converts descriptive outcomes into predictive evidence.
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const code=s=>typeof s==='string'&&/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(s);
export function summarizeStockDateOutcomes({rows=[],horizon=5,tolerance=0.000001}={}){
 if(!Array.isArray(rows)||rows.length>100000||!Number.isSafeInteger(horizon)||horizon<1||!Number.isFinite(tolerance)||tolerance<0||tolerance>0.01)throw new TypeError('INVALID_STOCK_DATE_COHORT_INPUT');
 const groups=new Map(),rejected=[];
 for(let i=0;i<rows.length;i++){
  const r=rows[i];
  if(!r||!date(r.date)||!code(r.code)||r.horizon!==horizon||!Number.isFinite(r.returnPercent)||r.returnPercent< -100){
   rejected.push({index:i,reason:'INVALID_OBSERVATION'});continue;
  }
  const key=JSON.stringify([r.date,r.code,r.horizon]),g=groups.get(key)||[];g.push(r);groups.set(key,g);
 }
 const accepted=[],conflicts=[];
 for(const [key,group] of groups){
  const values=group.map(r=>r.returnPercent),min=Math.min(...values),max=Math.max(...values);
  if(max-min>tolerance){conflicts.push({stockDateHorizon:key,eventRows:group.length,reason:'CONFLICTING_STOCK_DATE_OUTCOMES'});continue}
  const r=group[0];accepted.push({date:r.date,code:r.code,horizon,returnPercent:values.reduce((a,b)=>a+b,0)/values.length,sourceEventRows:group.length});
 }
 const distinctDates=new Set(accepted.map(r=>r.date)),distinctCodes=new Set(accepted.map(r=>r.code));
 const mean=accepted.length?accepted.reduce((a,r)=>a+r.returnPercent,0)/accepted.length:null;
 const ordered=accepted.map(r=>r.returnPercent).sort((a,b)=>a-b);
 const median=ordered.length?(ordered[Math.floor((ordered.length-1)/2)]+ordered[Math.floor(ordered.length/2)])/2:null;
 const perDate=new Map();
 for(const r of accepted){const g=perDate.get(r.date)||{sum:0,count:0};g.sum+=r.returnPercent;g.count++;perDate.set(r.date,g)}
 const equalDateMean=perDate.size?[...perDate.values()].reduce((s,g)=>s+g.sum/g.count,0)/perDate.size:null;
 return {researchOnly:true,productionEligible:false,aiPromotionAuthorized:false,independentImprovementVerified:false,
  counts:{submittedEventRows:rows.length,acceptedStockDates:accepted.length,distinctDates:distinctDates.size,distinctCodes:distinctCodes.size,duplicateEventRows:accepted.reduce((n,r)=>n+r.sourceEventRows-1,0),conflictingStockDates:conflicts.length,rejectedEventRows:rejected.length},
  summary:{meanReturnPercent:mean,medianReturnPercent:median,equalDateMeanReturnPercent:equalDateMean,positiveStockDates:accepted.filter(r=>r.returnPercent>0).length,negativeStockDates:accepted.filter(r=>r.returnPercent<0).length,zeroStockDates:accepted.filter(r=>r.returnPercent===0).length},
  accepted,conflicts,rejected,limitations:['NO_ORIGINAL_AS_OF_SIGNAL_ATTESTATION','NO_INDEPENDENT_PRICE_ATTESTATION','TWO_DATE_OR_SMALL_SAMPLE_BIAS_POSSIBLE','NO_FROZEN_BASELINE_OR_COSTS','NO_AI_PROMOTION']};
}
