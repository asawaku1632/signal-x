/** Offline research. Per-event observations, never independent stock-as-day samples. */
export function summarizeCrashByEvent(rows){
 if(!Array.isArray(rows))throw Error("INVALID_CRASH_EVENT_ROWS");
 const seen=new Set(),groups=new Map();let invalid=0,duplicates=0;
 for(const r of rows){
  if(!r||typeof r.eventDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(r.eventDate)||typeof r.code!=="string"||!["REBOUND_WATCH","RESISTANCE"].includes(r.category)||!Number.isFinite(r.excessReturn)){invalid++;continue;}
  const key=r.eventDate+"|"+r.code;if(seen.has(key)){duplicates++;continue;}seen.add(key);
  const bucket=r.category+"|"+r.eventDate,vals=groups.get(bucket)??[];vals.push(r.excessReturn);groups.set(bucket,vals);
 }
 const events=[...groups].map(([key,vals])=>({category:key.split("|")[0],date:key.split("|")[1],stocks:vals.length,meanExcess:vals.reduce((a,b)=>a+b,0)/vals.length}));
 return {events,independentDates:new Set(events.map(x=>x.date)).size,invalid,duplicates,readyForTrading:false,readyForTraining:false};
}
