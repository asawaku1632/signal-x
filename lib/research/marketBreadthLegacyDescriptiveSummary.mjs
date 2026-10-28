// Descriptive-only legacy cohorts. These are historical feature distributions, NOT performance claims.
import {partitionMarketBreadthLegacyRecords} from './marketBreadthLegacyRecordPartition.mjs';
const num=v=>v===null||v===undefined?null:(Number.isFinite(Number(v))?Number(v):null);
const groupKey=(kind,record)=>kind==='bb'?String(record.side??'UNKNOWN'):String(record.signal_type??'UNKNOWN');
export function summarizeMarketBreadthLegacyFeatures({bbEvents=[],technicalEvents=[]}={}){
 const partition=partitionMarketBreadthLegacyRecords({bbEvents,technicalEvents});
 const allowed=new Set(partition.descriptive.map(x=>JSON.stringify([x.kind,x.id,x.code,x.tradeDate])));
 const cohorts=new Map();
 for(const [kind,records] of [['bb',bbEvents],['technical',technicalEvents]]){
  for(const record of records){
   const tradeDate=kind==='bb'?record?.signal_date:record?.signal_trade_date;
   if(!allowed.has(JSON.stringify([kind,record?.id??null,record?.code??null,tradeDate])))continue;
   const label=groupKey(kind,record),key=JSON.stringify([kind,label]);
   const item=cohorts.get(key)??{kind,label,count:0,distinctDates:new Set(),sumAiPower:0,aiPowerSamples:0,priceSamples:0};
   item.count++;item.distinctDates.add(tradeDate);
   const power=num(kind==='bb'?record.raw_ai_power_after_bb:record.raw_ai_power_snapshot);
   if(power!==null){item.sumAiPower+=power;item.aiPowerSamples++}
   const price=num(record.entry_price);
   if(price!==null&&price>0)item.priceSamples++;
   cohorts.set(key,item);
  }
 }
 return {researchOnly:true,productionEligible:false,notificationEligible:false,performanceClaimsAllowed:false,counts:partition.counts,cohorts:[...cohorts.values()].map(x=>({kind:x.kind,label:x.label,count:x.count,distinctTradeDates:x.distinctDates.size,meanSavedAiPower:x.aiPowerSamples?Number((x.sumAiPower/x.aiPowerSamples).toFixed(3)):null,aiPowerSamples:x.aiPowerSamples,positiveEntryPriceSamples:x.priceSamples})).sort((a,b)=>b.count-a.count||a.kind.localeCompare(b.kind)||a.label.localeCompare(b.label))};
}
