import {evaluateShadowReplication} from "@/app/lib/learning/shadowReplicationAudit";
import type {PairedOutcome} from "@/app/lib/learning/pairedShadowComparison";
// SHADOW-only concentration audit. Positive return concentration is not statistical evidence of alpha.
export function auditShadowConcentration(rows:PairedOutcome[]){
 const replication=evaluateShadowReplication(rows);
 const byStock=new Map<string,number>(),byDay=new Map<string,number>();
 let totalPositive=0;
 for(const r of rows){
  const delta=r.shadowReturn5d-r.baselineReturn5d;
  if(!Number.isFinite(delta))continue;
  const positive=Math.max(0,delta);
  totalPositive+=positive;
  byStock.set(r.code,(byStock.get(r.code)??0)+positive);
  byDay.set(r.signalDate,(byDay.get(r.signalDate)??0)+positive);
 }
 const topStockShare=totalPositive>0?Math.max(0,...byStock.values())/totalPositive:null;
 const topDayShare=totalPositive>0?Math.max(0,...byDay.values())/totalPositive:null;
 const issues=[...replication.issues];
 if(totalPositive<=0)issues.push("NO_POSITIVE_DELTA");
 if(topStockShare!==null&&topStockShare>0.5)issues.push("SINGLE_STOCK_CONCENTRATION");
 if(topDayShare!==null&&topDayShare>0.5)issues.push("SINGLE_DAY_CONCENTRATION");
 return {status:issues.length?"BLOCKED" as const:"CONCENTRATION_REVIEW_ONLY" as const,issues,
  pairedCount:rows.length,topStockPositiveShare:replication.issues.length?null:topStockShare,
  topDayPositiveShare:replication.issues.length?null:topDayShare,
  statisticalSignificanceVerified:false as const,adoptionApproved:false as const,
  productionApplied:false as const,notificationEnabled:false as const};
}
