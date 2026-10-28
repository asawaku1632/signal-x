// Shadow-only grouping for distinct stock/date outcomes; multiple event types are not independent stock observations.
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function auditMarketBreadthObservationCohort({rows=[]}={}){
 if(!Array.isArray(rows)||rows.length>100000)throw new TypeError('INVALID_OBSERVATION_COHORT');
 const groups=new Map(),rejected=[];
 for(let i=0;i<rows.length;i++){
  const r=rows[i];
  if(!r||typeof r.code!=='string'||!/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(r.code)||!date(r.tradeDate)||!date(r.evaluatedTradeDate)||r.evaluatedTradeDate<=r.tradeDate||!Number.isFinite(r.returnPercent)||r.horizon!==5||r.horizonUnit!=='TRADING_DAY'){rejected.push({index:i,reason:'INVALID_OBSERVATION'});continue}
  const key=r.tradeDate+':'+r.code,group=groups.get(key)??{tradeDate:r.tradeDate,code:r.code,returns:[],eventCount:0};
  group.eventCount++;group.returns.push(r.returnPercent);groups.set(key,group);
 }
 const accepted=[],conflicts=[];
 for(const g of groups.values()){
  if(g.returns.some(v=>Math.abs(v-g.returns[0])>1e-9)){conflicts.push({tradeDate:g.tradeDate,code:g.code,reason:'CONFLICTING_STOCK_DATE_RETURNS'});continue}
  accepted.push({tradeDate:g.tradeDate,code:g.code,returnPercent:g.returns[0],eventCount:g.eventCount});
 }
 const dates=new Set(accepted.map(x=>x.tradeDate));
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  counts:{submittedRows:rows.length,validStockDateObservations:accepted.length,distinctTradeDates:dates.size,collapsedSameStockDateEvents:accepted.reduce((n,x)=>n+x.eventCount-1,0),conflictingGroups:conflicts.length,rejectedRows:rejected.length},
  accepted,conflicts,rejected,independentImprovementVerified:false,
  limitations:['NO_ORIGINAL_PREDICTION_TIMESTAMP_ATTESTATION','NO_INDEPENDENT_PRICE_VERIFICATION','NO_TRANSACTION_COSTS','NO_OUT_OF_SAMPLE_BASELINE','NO_PRODUCTION_PROMOTION']};
}
