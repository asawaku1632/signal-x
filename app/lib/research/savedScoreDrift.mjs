/** Descriptive monthly score drift. Never extrapolate to predictive power. */
export function summarizeSavedScoreDrift(rows){
 if(!Array.isArray(rows))throw Error("INVALID_SCORE_DRIFT_INPUT");
 const months=new Map(),excluded={invalid:0};
 for(const row of rows){
  if(!row||typeof row.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||
   typeof row.score!=="number"||!Number.isFinite(row.score)){excluded.invalid++;continue;}
  const key=row.date.slice(0,7);
  const group=months.get(key)||{month:key,observations:0,scoreSum:0,highCount:0};
  group.observations++;group.scoreSum+=row.score;
  if(row.score>=85)group.highCount++;
  months.set(key,group);
 }
 return {version:"SAVED_SCORE_MONTHLY_DRIFT_V1",months:[...months.values()]
  .sort((a,b)=>a.month.localeCompare(b.month))
  .map(x=>({month:x.month,observations:x.observations,
    meanScore:Number((x.scoreSum/x.observations).toFixed(2)),
    highCount:x.highCount,highRatePct:Number((100*x.highCount/x.observations).toFixed(2))})),
  excluded,shadowOnly:true,signalEligible:false,
  warning:"Stored scores may have different semantics across months; no validated predictive comparison."};
}
