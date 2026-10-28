import {evaluatePairedShadowComparison,type PairedOutcome} from "@/app/lib/learning/pairedShadowComparison";
export function evaluateShadowReplication(rows:PairedOutcome[]){
 const paired=evaluatePairedShadowComparison(rows);
 const dates=new Set(rows.map(r=>r.signalDate)),stocks=new Set(rows.map(r=>r.code));
 const perDate=new Map<string,{sum:number;count:number}>();
 const perStock=new Map<string,{sum:number;count:number}>();
 for(const r of rows){
  const delta=r.shadowReturn5d-r.baselineReturn5d;
  for(const [map,key] of [[perDate,r.signalDate],[perStock,r.code]] as const){
   const x=map.get(key)??{sum:0,count:0};x.sum+=delta;x.count++;map.set(key,x);
  }
 }
 const issues=[...paired.issues];
 if(dates.size<5)issues.push("INSUFFICIENT_DISTINCT_DATES");
 if(stocks.size<5)issues.push("INSUFFICIENT_DISTINCT_STOCKS");
 if(rows.length<20)issues.push("INSUFFICIENT_PAIRED_OBSERVATIONS");
 const dateMeans=[...perDate.values()].map(x=>x.sum/x.count);
 const stockMeans=[...perStock.values()].map(x=>x.sum/x.count);
 const positiveDateShare=dateMeans.length?dateMeans.filter(x=>x>0).length/dateMeans.length:null;
 const positiveStockShare=stockMeans.length?stockMeans.filter(x=>x>0).length/stockMeans.length:null;
 return {status:issues.length?"BLOCKED" as const:"SHADOW_REPLICATION_REVIEW_ONLY" as const,issues,pairedCount:rows.length,
  distinctDates:dates.size,distinctStocks:stocks.size,meanPairedDelta:issues.length?null:paired.averageDelta5d,
  positiveDateShare:issues.length?null:positiveDateShare,positiveStockShare:issues.length?null:positiveStockShare,
  verifiedImprovement:false as const,adoptionApproved:false as const,productionApplied:false as const,notificationEnabled:false as const};
}
