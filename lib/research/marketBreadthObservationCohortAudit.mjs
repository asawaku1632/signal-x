// Shadow-only grouping for distinct stock/date outcomes; multiple event types are not independent stock observations.
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function auditMarketBreadthObservationCohort({rows=[]}={}){
 if(!Array.isArray(rows)||rows.length>100000)throw new TypeError('INVALID_OBSERVATION_COHORT');
 const groups=new Map(),rejected=[];
 for(let i=0;i<rows.length;i++){
  const r=rows[i];
  if(!r||typeof r.code!=='string'||!/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(r.code)||!date(r.tradeDate)||!date(r.evaluatedTradeDate)||r.evaluatedTradeDate<=r.tradeDate||!Number.isFinite(r.returnPercent)||r.returnPercent < -100||r.horizon!==5||r.horizonUnit!=='TRADING_DAY'){rejected.push({index:i,reason:'INVALID_OBSERVATION'});continue}
  const key=r.tradeDate+':'+r.code,group=groups.get(key)??{tradeDate:r.tradeDate,code:r.code,returns:[],evaluationDates:[],eventCount:0};
  group.eventCount++;group.returns.push(r.returnPercent);group.evaluationDates.push(r.evaluatedTradeDate);groups.set(key,group);
 }
 const accepted=[],conflicts=[];
 for(const g of groups.values()){
  if(g.returns.some(v=>Math.abs(v-g.returns[0])>1e-9)||g.evaluationDates.some(d=>d!==g.evaluationDates[0])){conflicts.push({tradeDate:g.tradeDate,code:g.code,reason:'CONFLICTING_STOCK_DATE_OUTCOMES'});continue}
  accepted.push({tradeDate:g.tradeDate,code:g.code,evaluatedTradeDate:g.evaluationDates[0],returnPercent:g.returns[0],eventCount:g.eventCount});
 }
 const dates=new Set(accepted.map(x=>x.tradeDate));
 const stockCodes=new Set(accepted.map(x=>x.code));
 const byDate=[...dates].sort().map(tradeDate=>{const cohort=accepted.filter(x=>x.tradeDate===tradeDate),returns=cohort.map(x=>x.returnPercent);return {tradeDate,stockDateCount:cohort.length,meanReturnPercent:returns.reduce((a,b)=>a+b,0)/returns.length,positiveRate:returns.filter(v=>v>0).length/returns.length}});
 const sum=accepted.reduce((n,x)=>n+x.returnPercent,0);
 const dateMeans=byDate.map(d=>d.meanReturnPercent);
 const equalDateMeanReturnPercent=dateMeans.length?dateMeans.reduce((a,b)=>a+b,0)/dateMeans.length:null;
 const leaveOneDateOut=byDate.length>=2?byDate.map(heldOut=>{const training=byDate.filter(d=>d.tradeDate!==heldOut.tradeDate);const trainingMean=training.reduce((n,d)=>n+d.meanReturnPercent,0)/training.length;return {heldOutTradeDate:heldOut.tradeDate,heldOutMeanReturnPercent:heldOut.meanReturnPercent,otherDatesMeanReturnPercent:trainingMean,signAgreement:Math.sign(heldOut.meanReturnPercent)===Math.sign(trainingMean)}}):[];
 const sorted=accepted.map(x=>x.returnPercent).sort((a,b)=>a-b);
 const median=sorted.length?(sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2):null;
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  counts:{submittedRows:rows.length,validStockDateObservations:accepted.length,distinctTradeDates:dates.size,distinctStockCodes:stockCodes.size,collapsedSameStockDateEvents:accepted.reduce((n,x)=>n+x.eventCount-1,0),conflictingGroups:conflicts.length,rejectedRows:rejected.length},
  descriptiveStats:{meanReturnPercent:accepted.length?sum/accepted.length:null,equalDateMeanReturnPercent,medianReturnPercent:median,positiveRate:accepted.length?accepted.filter(x=>x.returnPercent>0).length/accepted.length:null},
  byDate,leaveOneDateOut,accepted,conflicts,rejected,independentImprovementVerified:false,
  limitations:['NO_ORIGINAL_PREDICTION_TIMESTAMP_ATTESTATION','NO_INDEPENDENT_PRICE_VERIFICATION','NO_TRANSACTION_COSTS','NO_OUT_OF_SAMPLE_BASELINE','DATE_CLUSTERING_NOT_INDEPENDENT','NO_PRODUCTION_PROMOTION']};
}
