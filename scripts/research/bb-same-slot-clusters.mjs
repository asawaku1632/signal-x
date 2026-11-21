#!/usr/bin/env node
/**
 * Descriptive, read-only co-signal audit. Cohorts are formed exclusively from
 * signal date + execution slot + DISTINCT stock code; never from future outcome.
 * This cannot establish a new entry/exit or risk rule from a tiny selected set.
 */
import {readFileSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {buildRiskDiagnostics} from "./bb-candle-risk-diagnostic.mjs";

export function studySameSlotClusters(records){
 if(!Array.isArray(records)||records.length<1||records.length>10000)
   throw Error("INVALID_CLUSTER_RECORDS");
 const groups=new Map(),seen=new Set();
 for(const r of records){
   if(typeof r?.code!=="string"||!/^[0-9]{3}[0-9A-Z]$/.test(r.code)||
      typeof r.date!=="string"||!/^20\d\d-\d\d-\d\d$/.test(r.date)||
      !["09:20","11:20","14:15"].includes(r.time)||
      !["UP","DOWN","SIDEWAYS"].includes(r.priorMarket)||
      !(r.after5dPct===null||Number.isFinite(r.after5dPct))||
      !(r.worstDip5dPct===null||Number.isFinite(r.worstDip5dPct)))
     throw Error("INVALID_CLUSTER_EVENT");
   const id=r.code+"|"+r.date+"|"+r.time;
   if(seen.has(id))throw Error("DUPLICATE_CLUSTER_EVENT");
   seen.add(id);
   const key=r.date+"|"+r.time;
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push(r);
 }
 const clusters=[...groups].map(([key,rows])=>{
   const [date,time]=key.split("|");
   if(new Set(rows.map(r=>r.priorMarket)).size!==1)
     throw Error("MISMATCHED_MARKET_CONTEXT");
   const mature=rows.filter(r=>r.after5dPct!==null);
   return {date,time,distinctStocks:rows.length,codes:rows.map(r=>r.code).sort(),
     priorMarket:rows[0].priorMarket,
     mature5d:mature.length,nonpositive5d:mature.filter(r=>r.after5dPct<=0).length,
     // Individual matured outcomes, NOT a win-rate prediction.
     examples:mature.map(r=>({code:r.code,after5dPct:r.after5dPct,
       worstDip5dPct:r.worstDip5dPct})).sort((a,b)=>a.code.localeCompare(b.code))};
 }).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
 const multiple=clusters.filter(x=>x.distinctStocks>=2);
 const solo=clusters.filter(x=>x.distinctStocks===1);
 const enough=multiple.length>=30&&solo.length>=30&&
   new Set(multiple.map(x=>x.date)).size>=15&&new Set(solo.map(x=>x.date)).size>=15;
 return {status:"BB_SAME_SLOT_CLUSTER_SHADOW_ONLY",totalDistinctBuyEvents:records.length,
   totalDateTimeGroups:clusters.length,multipleSignalGroups:multiple.length,
   singletonGroups:solo.length,
   multiClusters:multiple,soloGroups:solo.map(x=>({date:x.date,time:x.time,
      code:x.codes[0],priorMarket:x.priorMarket,mature5d:x.mature5d})),
   comparativeRates:null,
   rateStatus:enough?"NOT_AUTOMATICALLY_PUBLISHED_REQUIRES_INDEPENDENCE_AUDIT":"INSUFFICIENT_INDEPENDENT_DATES",
   hypothesis:"DATE_TIME_CLUSTER_ASSOCIATION_NOT_CAUSATION",
   postSignalOutcomesUsedForClustering:false,
   eligibleForProduction:false,eligibleForNotifications:false,
   note:"Historical tiny cohort; clustered stocks share market shock. No cutoff or trade filter justified."};
}
const load=(p,max)=>{const s=statSync(p).size;
 if(s<2||s>max)throw Error("INVALID_LOCAL_FILE_SIZE");
 return JSON.parse(readFileSync(p,"utf8"));
};
export function run(paths){
 if(!Array.isArray(paths)||paths.length!==6)throw Error("REQUIRE_TOPIX_THREE_STOCKS_TWO_8053");
 const [t,a,b,c,d,e]=paths.map((p,i)=>load(p,i===0?250000:8000000));
 const previous=buildRiskDiagnostics({benchmark:t,threeArchives:[a,b,c],overlapFirst:d,overlapSecond:e});
 return studySameSlotClusters(previous.records);
}
const running=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(running){
 try{console.log(JSON.stringify(run(process.argv.slice(2)),null,2));}
 catch(e){console.error("BB_CLUSTER_BLOCKED",
    e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?e.message:"INVALID_PRIVATE_INPUT");
    process.exitCode=1;}
}
