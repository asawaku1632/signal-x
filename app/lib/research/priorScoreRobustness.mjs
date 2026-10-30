/**
 * Offline-only same-date comparison. Regime uses complete-day outcomes and
 * MUST NOT be consumed as a live market input. No I/O or trading pathways.
 */
const validDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  !Number.isNaN(Date.parse(x+"T00:00:00Z"))&&
  new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const number=x=>typeof x==="number"&&Number.isFinite(x);
const median=xs=>{if(!xs.length)return null;const a=[...xs].sort((a,b)=>a-b),m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;};
const round=x=>x===null?null:Number(x.toFixed(4));
export function researchPriorScoreDailyGaps(rows,{startDate="2026-09-02",minPerGroup=10,clipPct=5,omitExtremeDates=3}={}){
 if(!Array.isArray(rows)||!validDate(startDate)||!Number.isInteger(minPerGroup)||minPerGroup<1||
  !number(clipPct)||clipPct<=0||!Number.isInteger(omitExtremeDates)||omitExtremeDates<0)
  throw Error("INVALID_DAILY_GAP_OPTIONS");
 const seen=new Set(),byDate=new Map();
 const excluded={invalid:0,beforeStart:0,duplicate:0,missingPriorEvidence:0,missingOutcome:0};
 for(const row of rows){
  if(!row||!validDate(row.date)||typeof row.code!=="string"||
    !/^(?:\d{4}|\d{3}[A-Z])$/.test(row.code)){
   excluded.invalid++;continue;
  }
  if(row.date<startDate){excluded.beforeStart++;continue;}
  const key=row.date+"|"+row.code;
  if(seen.has(key)){excluded.duplicate++;continue;}
  seen.add(key);
  if(!number(row.priorScore)||!validDate(row.priorDate)||row.priorDate>=row.date||
    row.priorEvidenceVerified!==true){excluded.missingPriorEvidence++;continue;}
  if(!number(row.price)||row.price<=0||!number(row.nextPrice)||row.nextPrice<=0||
    row.outcomeProvenanceVerified!==true||!validDate(row.outcomeDate)||row.outcomeDate<=row.date){
   excluded.missingOutcome++;continue;
  }
  const ret=100*(row.nextPrice/row.price-1);
  if(!number(ret)){excluded.invalid++;continue;}
  if(!byDate.has(row.date))byDate.set(row.date,[]);
  byDate.get(row.date).push({high:row.priorScore>=85,ret,code:row.code});
 }
 const days=[],codes=new Map();
 for(const [date,records] of byDate){
  const high=records.filter(x=>x.high),low=records.filter(x=>!x.high);
  if(high.length<minPerGroup||low.length<minPerGroup)continue;
  const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
  const highAvg=avg(high.map(x=>x.ret)),lowAvg=avg(low.map(x=>x.ret));
  const clamp=x=>Math.max(-clipPct,Math.min(clipPct,x));
  const gap=highAvg-lowAvg;
  const clipped=avg(high.map(x=>clamp(x.ret)))-avg(low.map(x=>clamp(x.ret)));
  const market=avg(records.map(x=>x.ret));
  const regime=market>0.25?"UP":market< -0.25?"DOWN":"FLAT";
  days.push({date,gap,clipped,regime,highCount:high.length,lowCount:low.length});
  for(const r of high)codes.set(r.code,(codes.get(r.code)||0)+1);
 }
 days.sort((a,b)=>a.date.localeCompare(b.date));
 const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
 const summarized=groups=>Object.fromEntries(["DOWN","FLAT","UP"].map(k=>{
  const a=groups.filter(x=>x.regime===k);
  return [k,{days:a.length,meanGap:round(mean(a.map(x=>x.gap))),outperformDays:a.filter(x=>x.gap>0).length}];
 }));
 const extremes=[...days].sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap)||a.date.localeCompare(b.date))
  .slice(0,omitExtremeDates);
 const extremeDates=new Set(extremes.map(x=>x.date));
 const remaining=days.filter(x=>!extremeDates.has(x.date));
 const ranked=[...codes.values()].sort((a,b)=>b-a);
 return {version:"PRIOR_SCORE_DAILY_GAP_OFFLINE_V1",startDate,days:days.length,
  highRows:days.reduce((s,d)=>s+d.highCount,0),lowRows:days.reduce((s,d)=>s+d.lowCount,0),
  meanGap:round(mean(days.map(x=>x.gap))),medianGap:round(median(days.map(x=>x.gap))),
  positiveGapDays:days.filter(x=>x.gap>0).length,
  clippedMeanGap:round(mean(days.map(x=>x.clipped))),
  extremeDatesOmitted:extremes.length,remainingDays:remaining.length,
  afterExtremeMeanGap:round(mean(remaining.map(x=>x.gap))),
  codeCount:codes.size,top10Observations:ranked.slice(0,10).reduce((a,b)=>a+b,0),
  regimes:summarized(days),excluded,shadowOnly:true,
  warning:"Retrospective day-outcome regimes, not as-of predictive features; inputs require independently verified provenance. No live signal, trading, or claim of calibrated probability."};
}
