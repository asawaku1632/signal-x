/** Offline audit for post-close Nikkei event records. Never infers preopen availability. */
export function inspectCrashIndexEvidence(records){
 if(!Array.isArray(records)||records.length>1000)throw Error("INVALID_CRASH_INDEX_ROWS");
 const counts={total:records.length,retrospective:0,invalid:0,duplicate:0};
 const dates=new Set(),rows=[];
 for(const r of records){
  const date=r?.trade_date;
  if(typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+"T00:00:00Z"))||new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date){counts.invalid++;continue;}
  if(dates.has(date)){counts.duplicate++;continue;}dates.add(date);
  const valid=typeof r.selected_at==="string"&&Number.isFinite(Date.parse(r.selected_at))&&
    Number.isFinite(r.nikkei_close)&&r.nikkei_close>0&&Number.isFinite(r.nikkei_previous_close)&&r.nikkei_previous_close>0;
  if(!valid){counts.invalid++;rows.push({date,status:"INVALID_RECORD"});continue;}
  counts.retrospective++;rows.push({date,status:"RETROSPECTIVE_ONLY",after0905:Date.parse(r.selected_at)>=Date.parse(date+"T09:05:00+09:00")});
 }
 return {counts,rows,predecisionAuthenticated:0,tradingEnabled:false,learningEnabled:false,
 warning:"Post-close index observations are useful for retrospective context, not authenticated preopen signals."};
}
