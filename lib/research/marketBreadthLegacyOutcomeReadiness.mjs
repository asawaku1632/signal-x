// Pure, shadow-only eligibility audit. Never reads a database or authorizes production.
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const time=s=>typeof s==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s));
const code=s=>typeof s==='string'&&/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(s);
const jstDay=s=>new Date(Date.parse(s)+32400000).toISOString().slice(0,10);
export function auditLegacyOutcomeReadiness({rows=[]}={}){
 if(!Array.isArray(rows)||rows.length>100000)throw new TypeError('INVALID_LEGACY_OUTCOME_INPUT');
 const groups=new Map(),rejected=[];
 for(let index=0;index<rows.length;index++){
  const r=rows[index];
  if(!r||!date(r.date)||!code(r.code)||!Number.isFinite(r.score)||r.score<0||r.score>100||!Number.isFinite(r.price)||r.price<=0||!time(r.createdAt)||!['WIN','LOSE','HOLD','UNKNOWN'].includes(r.result)){
   rejected.push({index,reason:'INVALID_INPUT'});continue;
  }
  const key=r.date+':'+r.code;
  const group=groups.get(key)||[];group.push({r,index});groups.set(key,group);
 }
 const accepted=[],quarantined=[];
 for(const [stockDate,group] of groups){
  if(group.length!==1){quarantined.push({stockDate,reason:'DUPLICATE_STOCK_DATE',count:group.length});continue}
  const {r}=group[0], reasons=[];
  if(jstDay(r.createdAt)!==r.date)reasons.push('SAVED_ON_DIFFERENT_TOKYO_DATE');
  if(!time(r.checkedAt)||Date.parse(r.checkedAt)<=Date.parse(r.createdAt))reasons.push('MISSING_OR_INVALID_EVALUATION_TIME');
  if(!['WIN','LOSE'].includes(r.result))reasons.push('NOT_FINAL_WIN_LOSE');
  if(!Number.isFinite(r.nextPrice)||r.nextPrice<=0)reasons.push('MISSING_FUTURE_PRICE');
  if(!Number.isFinite(r.changePercent)||r.changePercent< -100)reasons.push('INVALID_CHANGE_PERCENT');
  if(Number.isFinite(r.nextPrice)&&r.nextPrice>0&&Number.isFinite(r.changePercent)){
   const implied=(r.nextPrice/r.price-1)*100;
   if(Math.abs(implied-r.changePercent)>0.05)reasons.push('PRICE_RETURN_MISMATCH');
  }
  if(reasons.length){quarantined.push({stockDate,reasons});continue}
  accepted.push({date:r.date,code:r.code,score:r.score,price:r.price,nextPrice:r.nextPrice,changePercent:r.changePercent,result:r.result});
 }
 const distinctDates=new Set(accepted.map(r=>r.date));
 const codes=new Set(accepted.map(r=>r.code));
 return {researchOnly:true,productionEligible:false,aiPromotionAuthorized:false,independentImprovementVerified:false,
  counts:{submitted:rows.length,accepted:accepted.length,rejected:rejected.length,quarantined:quarantined.length,distinctDates:distinctDates.size,distinctCodes:codes.size},
  accepted,quarantined,rejected,
  limitations:['ORIGINAL_SIGNAL_TIME_NOT_ATTESTED','EVALUATION_HORIZON_NOT_ATTESTED','PRICE_PROVIDER_NOT_INDEPENDENTLY_VERIFIED','NO_OUT_OF_SAMPLE_BASELINE','NO_TRANSACTION_COSTS','NO_PRODUCTION_PROMOTION']};
}
