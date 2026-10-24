// Research-only chronological partitions and non-overlapping samples.
// Index-based embargo uses completed trading-session indices, not calendar days.
export function embargoEvents(ledger,{horizon=5}={}){
 if(!Array.isArray(ledger)||!Number.isInteger(horizon)||horizon<1)throw Error("INVALID_INPUT");
 const sorted=[...ledger].sort((a,b)=>a.code.localeCompare(b.code)||a.signalSessionIndex-b.signalSessionIndex||a.cohort.localeCompare(b.cohort));
 const lastAccepted=new Map(),accepted=[],suppressed=[];
 for(const e of sorted){
  if(typeof e.code!=="string"||!Number.isInteger(e.signalSessionIndex)||e.signalSessionIndex<0)throw Error("INVALID_EVENT");
  const previous=lastAccepted.get(e.code);
  if(previous!==undefined&&e.signalSessionIndex-previous<=horizon)suppressed.push({code:e.code,startDate:e.startDate,reason:"SAME_STOCK_EMBARGO"});
  else{accepted.push(e);lastAccepted.set(e.code,e.signalSessionIndex);}
 }
 return {horizon,accepted,suppressed,acceptedCount:accepted.length,suppressedCount:suppressed.length};
}
export function chronologicalHoldout(ledger,{cutoffDate,embargoCalendarDays=10}={}){
 if(!Array.isArray(ledger)||typeof cutoffDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate)||!Number.isInteger(embargoCalendarDays)||embargoCalendarDays<0||embargoCalendarDays>365)throw Error("INVALID_SPLIT");
 const cutoff=Date.parse(cutoffDate+"T00:00:00Z");
 if(!Number.isFinite(cutoff))throw Error("INVALID_SPLIT");
 const train=[],holdout=[],embargoed=[];
 for(const e of ledger){
  const t=Date.parse(e.startDate+"T00:00:00Z");
  if(!Number.isFinite(t))throw Error("INVALID_EVENT_DATE");
  if(t<cutoff-embargoCalendarDays*86400000)train.push(e);
  else if(t>=cutoff)holdout.push(e);
  else embargoed.push(e);
 }
 return {cutoffDate,embargoCalendarDays,train,holdout,embargoed,hasBothPartitions:train.length>0&&holdout.length>0,
  warning:"Calendar embargo is conservative but not equivalent to exchange trading-session embargo."};
}
export function aggregateBySignalDate(ledger,{horizon=5,metric="nextOpenToFutureClose"}={}){
 if(!Array.isArray(ledger)||![1,3,5,10].includes(horizon)||!["legacyCloseToClose","nextOpenToFutureClose"].includes(metric))throw Error("INVALID_INPUT");
 const groups=new Map();
 for(const e of ledger){
  const outcome=e.outcomes?.[horizon]?.[metric];
  if(!outcome)throw Error("INVALID_OUTCOME");
  const k=e.startDate;
  if(!groups.has(k))groups.set(k,{date:k,events:0,matured:0,positive:0,sumReturnPct:0});
  const row=groups.get(k);row.events++;
  if(outcome.status==="MATURED"){
   if(!Number.isFinite(outcome.returnPct))throw Error("INVALID_RETURN");
   row.matured++;row.sumReturnPct+=outcome.returnPct;if(outcome.returnPct>0)row.positive++;
  }
 }
 return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(x=>({date:x.date,events:x.events,matured:x.matured,
  positive:x.positive,meanReturnPct:x.matured?Number((x.sumReturnPct/x.matured).toFixed(3)):null}));
}
