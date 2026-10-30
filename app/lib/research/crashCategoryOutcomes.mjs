/** Offline one-event category outcomes: 40 stocks from one day are one independent event. */
export function auditCrashCategoryOutcomes(rows,{minEvents=20}={}){
 if(!Array.isArray(rows)||!Number.isInteger(minEvents)||minEvents<2)throw Error("INVALID_CRASH_OUTCOMES");
 const keys=new Set(),events=new Set(),groups=new Map();
 let excluded=0,duplicates=0;
 for(const r of rows){
  if(!r||typeof r.eventDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(r.eventDate)||!["REBOUND_WATCH","RESISTANCE"].includes(r.category)||typeof r.code!=="string"||!Number.isFinite(r.excessReturn)){excluded++;continue;}
  const key=r.eventDate+"|"+r.code;
  if(keys.has(key)){duplicates++;continue;}keys.add(key);events.add(r.eventDate);
  const bucket=groups.get(r.category)||{n:0,excessSum:0,beat:0};
  bucket.n++;bucket.excessSum+=r.excessReturn;if(r.excessReturn>0)bucket.beat++;groups.set(r.category,bucket);
 }
 const categories=[...groups].sort((a,b)=>a[0].localeCompare(b[0])).map(([category,g])=>({category,candidates:g.n,meanExcessReturn:Number((g.excessSum/g.n).toFixed(4)),beatCount:g.beat}));
 return {distinctEvents:events.size,categories,excluded,duplicates,minimumEvents:minEvents,
  researchStatus:events.size<minEvents?"INSUFFICIENT_INDEPENDENT_EVENTS":"DESCRIPTIVE_ONLY",
  tradingEnabled:false,trainingEnabled:false,warning:"Stock observations from one event are correlated; source and as-of evidence are not authenticated."};
}
