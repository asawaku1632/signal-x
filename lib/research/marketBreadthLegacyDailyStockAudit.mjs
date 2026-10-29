// Pure shadow-only validation for legacy daily_stock_results exports. Never queries a database.
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const validTime=s=>typeof s==='string'&&!Number.isNaN(Date.parse(s))&&/(?:Z|[+-]\d{2}:\d{2})$/.test(s);
export function auditLegacyDailyStockRows({rows=[]}={}){
 if(!Array.isArray(rows)||rows.length>100000)throw new TypeError('INVALID_LEGACY_ROWS');
 const groups=new Map(),rejected=[];
 for(let i=0;i<rows.length;i++){
  const r=rows[i];
  if(!r||!validDate(r.date)||typeof r.code!=='string'||!/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(r.code)||!Number.isFinite(r.score)||r.score<0||r.score>100||!Number.isFinite(r.price)||r.price<=0||!['WIN','LOSE','HOLD','UNKNOWN'].includes(r.result)||!validTime(r.createdAt)){rejected.push({index:i,reason:'INVALID_LEGACY_ROW'});continue}
  const key=r.date+':'+r.code;
  const g=groups.get(key)??[];g.push(r);groups.set(key,g);
 }
 const accepted=[],conflicts=[];
 for(const [key,group] of groups){
  if(group.length>1){conflicts.push({stockDate:key,count:group.length,reason:'DUPLICATE_STOCK_DATE'});continue}
  const r=group[0],createdDate=r.createdAt.slice(0,10);
  const checked=r.checkedAt==null?null:validTime(r.checkedAt)?Date.parse(r.checkedAt):NaN;
  const generated=Date.parse(r.createdAt);
  const temporalEligible=createdDate===r.date&&checked!==null&&Number.isFinite(checked)&&checked>generated;
  accepted.push({date:r.date,code:r.code,score:r.score,result:r.result,temporalEligible,hasCheckedAt:checked!==null&&Number.isFinite(checked)});
 }
 const dates=new Set(accepted.map(x=>x.date));
 return {researchOnly:true,productionEligible:false,aiPromotionAuthorized:false,
  counts:{submitted:rows.length,accepted:accepted.length,distinctDates:dates.size,duplicateGroups:conflicts.length,rejected:rejected.length,temporallyPlausible:accepted.filter(x=>x.temporalEligible).length},
  accepted,conflicts,rejected,
  limitations:['CREATED_AT_IS_NOT_ORIGINAL_SIGNAL_ATTESTATION','NO_VERIFIED_PROVIDER_PRICES','NO_DEFINED_OUTCOME_HORIZON','NO_BASELINE_OR_COSTS','NO_PRODUCTION_PROMOTION']};
}
