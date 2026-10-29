/**
 * MORNING_ANALOG_V1 — offline, read-only historical research.
 * Input rows MUST be frozen as of the previous trading day's close.
 * Intraday OHLC bars are outcome evidence, never candidate-selection inputs.
 * No provider fetches, persistence, trading, notifications or model updates.
 */
const positive = x => typeof x === "number" && Number.isFinite(x) && x > 0;
const finite = x => typeof x === "number" && Number.isFinite(x);
const round = x => Number(x.toFixed(4));
const hhmm = x => /^([01]\d|2[0-3]):[0-5]\d$/.test(x);
const minute = x => Number(x.slice(0,2))*60+Number(x.slice(3));
const validDate = x => {
  if(typeof x!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;
  const [y,m,d]=x.split("-").map(Number);
  const t=new Date(Date.UTC(y,m-1,d));
  return t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d;
};
const priorSnapshot = (stamp, tradeDate) => typeof stamp === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(stamp) &&
  Number.isFinite(Date.parse(stamp)) &&
  // Compare real instants against the JST start of the trade date. A UTC or
  // negative-offset timestamp can have a different calendar date from JST.
  Date.parse(stamp) < Date.parse(tradeDate + "T00:00:00+09:00");
const quantile = (xs,q) => {
  if(!xs.length)return null;
  const sorted=[...xs].sort((a,b)=>a-b),p=(sorted.length-1)*q,i=Math.floor(p);
  return round(sorted[i]+(sorted[Math.min(i+1,sorted.length-1)]-sorted[i])*(p-i));
};
const average = xs => xs.length?round(xs.reduce((a,b)=>a+b,0)/xs.length):null;
export const MORNING_ANALOG_VERSION="MORNING_ANALOG_V1";

/** Strict complete morning bars; no invented intra-bar ordering. */
export function inspectMorning(tradeDate, previousClose, candles, options={}) {
  const interval=options.intervalMinutes??5;
  if(!validDate(tradeDate)||!positive(previousClose)||
     !Number.isInteger(interval)||interval<1||60%interval!==0||
     !Array.isArray(candles))return {valid:false,reason:"INVALID_INPUT"};
  const bars=candles.filter(b=>b?.date===tradeDate && hhmm(b.time) &&
    minute(b.time)>=540 && minute(b.time)<690).sort((a,b)=>minute(a.time)-minute(b.time));
  const expected=(690-540)/interval;
  if(bars.length!==expected)return {valid:false,reason:"INCOMPLETE_MORNING_BARS"};
  for(let i=0;i<bars.length;i++){
    const b=bars[i],t=540+i*interval;
    if(minute(b.time)!==t||!positive(b.open)||!positive(b.high)||
       !positive(b.low)||!positive(b.close)||b.low>Math.min(b.open,b.close)||
       b.high<Math.max(b.open,b.close)||b.low>b.high)
      return {valid:false,reason:"INVALID_OR_MISSING_BAR"};
  }
  const minLow=Math.min(...bars.map(b=>b.low));
  const firstBottom=bars.find(b=>b.low===minLow);
  // A bottom is known retrospectively only. This is descriptive, NOT a tradable fill.
  const after=bars.filter(b=>minute(b.time)>minute(firstBottom.time));
  const maxLaterHigh=after.length?Math.max(...after.map(b=>b.high)):null;
  const earlyLow=Math.min(...bars.filter(b=>minute(b.time)<570).map(b=>b.low));
  return {valid:true,date:tradeDate,intervalMinutes:interval,
    bottomWindow:firstBottom.time,bottomPrice:minLow,
    bottomDropPct:round((minLow/previousClose-1)*100),
    earlyDropPct:round((earlyLow/previousClose-1)*100),
    laterHigh:maxLaterHigh,
    reboundPct:maxLaterHigh===null?null:round((maxLaterHigh/minLow-1)*100),
    rebound1pct:maxLaterHigh===null?null:maxLaterHigh>=minLow*1.01,
    rebound2pct:maxLaterHigh===null?null:maxLaterHigh>=minLow*1.02};
}

/**
 * Historical similarity must be determined from immutable prior-day features.
 * Caller must supply feature snapshots and their availability timestamp.
 */
export function summarizeAnalogs(target, histories, options={}) {
  const minSamples=options.minSamples??30;
  if(!target||!validDate(target.tradeDate)||
     !Array.isArray(histories)||!Number.isInteger(minSamples)||minSamples<1)
    throw Error("INVALID_ANALOG_INPUT");
  const keys=["priorReturnPct","priorRangePct","priorVolumeRatio","aiPower"];
  const weights=options.weights??{priorReturnPct:1,priorRangePct:1,priorVolumeRatio:2,aiPower:0.1};
  const maxAnalogs=options.maxAnalogs??100;
  if(!Number.isInteger(maxAnalogs)||maxAnalogs<1||
     keys.some(k=>!finite(weights[k])||weights[k]<0))
    throw Error("INVALID_ANALOG_OPTIONS");
  const usableFeatures = row => keys.every(k=>finite(row?.features?.[k]));
  if(!usableFeatures(target))throw Error("MISSING_PRIOR_DAY_FEATURES");
  // Target features also need an as-of proof; otherwise target-day hindsight
  // can silently influence historical similarity selection.
  if(!priorSnapshot(target.featureAvailableAt,target.tradeDate))
    throw Error("TARGET_FEATURE_LOOKAHEAD");
  // Optional strict provenance mode for empirical replay: a prior day's outcome
  // cannot enter the analog pool until its observation was actually available.
  // Without this proof the result remains retrospective and non-tradable.
  const requireOutcomeAvailability=options.requireOutcomeAvailability===true;
  const cutoff=Date.parse(target.tradeDate+"T00:00:00+09:00");
  const outcomeAvailable=row=>!requireOutcomeAvailability ||
    (typeof row.outcomeAvailableAt==="string" &&
     /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(row.outcomeAvailableAt) &&
     Number.isFinite(Date.parse(row.outcomeAvailableAt)) &&
     Date.parse(row.outcomeAvailableAt)<cutoff &&
     Date.parse(row.outcomeAvailableAt)>=Date.parse(row.tradeDate+"T11:30:00+09:00"));
  const pool=histories.filter(row=>row && validDate(row.tradeDate) && row.tradeDate<target.tradeDate &&
    outcomeAvailable(row) &&
    priorSnapshot(row.featureAvailableAt,row.tradeDate) &&
    usableFeatures(row) && row.outcome?.valid===true &&
    row.outcome.date===row.tradeDate &&
    positive(row.outcome.bottomPrice) && finite(row.outcome.bottomDropPct) &&
    hhmm(row.outcome.bottomWindow) && minute(row.outcome.bottomWindow)>=540 &&
    minute(row.outcome.bottomWindow)<690);
  // One stock/date is one independent historical observation. Duplicate exports
  // must not inflate sample size or rebound frequency.
  // Conflicting duplicate exports are ambiguous: exclude the entire key,
  // rather than allowing input order to choose a favorable outcome.
  const grouped=new Map();
  for(const row of pool){
    if(typeof row.code!=="string"||!/^(?:\d{4}|\d{3}[A-Z])$/.test(row.code))continue;
    const key=row.code+"|"+row.tradeDate;
    const rows=grouped.get(key)??[];
    rows.push(row);
    grouped.set(key,rows);
  }
  const unique=[...grouped.values()].flatMap(rows=>{
    const fingerprint=row=>JSON.stringify({
      featureAvailableAt:row.featureAvailableAt,outcomeAvailableAt:row.outcomeAvailableAt,features:keys.map(k=>row.features[k]),
      bottomPrice:row.outcome.bottomPrice,bottomDropPct:row.outcome.bottomDropPct,
      bottomWindow:row.outcome.bottomWindow,earlyDropPct:row.outcome.earlyDropPct,
      laterHigh:row.outcome.laterHigh,reboundPct:row.outcome.reboundPct,
      intervalMinutes:row.outcome.intervalMinutes,
      rebound1pct:row.outcome.rebound1pct,rebound2pct:row.outcome.rebound2pct
    });
    return rows.every(row=>fingerprint(row)===fingerprint(rows[0]))?[rows[0]]:[];
  });
  const ranked=unique.map(row=>({row,distance:keys.reduce((sum,k)=>
    sum+Math.abs(row.features[k]-target.features[k])*(weights[k]??1),0)}))
    .sort((a,b)=>a.distance-b.distance || a.row.tradeDate.localeCompare(b.row.tradeDate));
  const selected=ranked.slice(0,maxAnalogs).map(x=>x.row);
  const drops=selected.map(x=>x.outcome.bottomDropPct);
  const times=selected.map(x=>minute(x.outcome.bottomWindow));
  const rebounds1=selected.filter(x=>typeof x.outcome.rebound1pct==="boolean");
  const rebounds2=selected.filter(x=>typeof x.outcome.rebound2pct==="boolean");
  return {version:MORNING_ANALOG_VERSION,asOf:target.tradeDate,
    samples:selected.length,eligible:selected.length>=minSamples,
    bottomDropPct:{p25:quantile(drops,.25),median:quantile(drops,.5),p75:quantile(drops,.75)},
    bottomWindowMinutes:{p25:quantile(times,.25),median:quantile(times,.5),p75:quantile(times,.75)},
    rebound1pct:{observed:rebounds1.length,wins:rebounds1.filter(x=>x.outcome.rebound1pct).length,
      rate:rebounds1.length>=minSamples?round(100*rebounds1.filter(x=>x.outcome.rebound1pct).length/rebounds1.length):null},
    rebound2pct:{observed:rebounds2.length,wins:rebounds2.filter(x=>x.outcome.rebound2pct).length,
      rate:rebounds2.length>=minSamples?round(100*rebounds2.filter(x=>x.outcome.rebound2pct).length/rebounds2.length):null},
    // Do not expose historical outcome dates as target-day data.
    note:"Descriptive only. Requires held-out chronological validation before forecasting."};
}

/**
 * Aggregate completed, retrospective morning observations. This answers
 * "what happened most often?" rather than implying a tradable forecast.
 * A qualifying early drop is based on the 09:00-09:30 observed low.
 * Price percentages are relative to the prior close, not nominal yen.
 */
export function summarizeMorningDropPatterns(observations, options={}) {
  const minSamples=options.minSamples??30;
  const dropThresholdPct=options.dropThresholdPct??3;
  const binMinutes=options.binMinutes??5;
  if(!Array.isArray(observations)||!Number.isInteger(minSamples)||minSamples<1||
     !positive(dropThresholdPct)||!Number.isInteger(binMinutes)||binMinutes<1||
     60%binMinutes!==0)throw Error("INVALID_PATTERN_OPTIONS");
  const seen=new Set(),valid=[],excluded={invalid:0,duplicate:0,notSharpDrop:0};
  for(const row of observations){
    if(!row||row.valid!==true||!validDate(row.date)||
       (!hhmm(row.bottomWindow)||minute(row.bottomWindow)<540||minute(row.bottomWindow)>=690)||
       !positive(row.bottomPrice)||
       !finite(row.bottomDropPct)||!finite(row.earlyDropPct)||
       !Number.isInteger(row.intervalMinutes)||row.intervalMinutes<1||row.intervalMinutes>binMinutes||
       binMinutes%row.intervalMinutes!==0||
       typeof row.code!=="string"||!row.code){
      excluded.invalid++;continue;
    }
    const id=row.code+"|"+row.date;
    if(seen.has(id)){excluded.duplicate++;continue;}
    seen.add(id);
    if(row.earlyDropPct>-dropThresholdPct){excluded.notSharpDrop++;continue;}
    valid.push(row);
  }
  const histogram=new Map();
  for(const row of valid){
    const start=Math.floor(minute(row.bottomWindow)/binMinutes)*binMinutes;
    histogram.set(start,(histogram.get(start)??0)+1);
  }
  const toTime=m=>String(Math.floor(m/60)).padStart(2,"0")+":"+
    String(m%60).padStart(2,"0");
  const bottomTimeCounts=[...histogram].sort((a,b)=>a[0]-b[0])
    .map(([start,count])=>({windowStart:toTime(start),windowEnd:toTime(start+binMinutes),count}));
  const maxCount=Math.max(0,...bottomTimeCounts.map(x=>x.count));
  const topWindows=bottomTimeCounts.filter(x=>x.count===maxCount && maxCount>0);
  const reb1=valid.filter(x=>typeof x.rebound1pct==="boolean");
  const reb2=valid.filter(x=>typeof x.rebound2pct==="boolean");
  return {version:"MORNING_DROP_PATTERN_V1",definition:{
    morning:"09:00-11:30 JST",earlyDrop:"09:00-09:30 low vs prior close",
    thresholdPct:dropThresholdPct,binMinutes,
    rebound:"later completed bar high after first morning low (no same-bar sequencing)"},
    samples:valid.length,eligible:valid.length>=minSamples,excluded,
    bottomTimeCounts,topWindows,
    bottomDropPct:{mean:average(valid.map(x=>x.bottomDropPct)),
      median:quantile(valid.map(x=>x.bottomDropPct),.5),
      p25:quantile(valid.map(x=>x.bottomDropPct),.25),
      p75:quantile(valid.map(x=>x.bottomDropPct),.75)},
    rebound1pct:{observed:reb1.length,wins:reb1.filter(x=>x.rebound1pct).length,
      rate:reb1.length>=minSamples?round(100*reb1.filter(x=>x.rebound1pct).length/reb1.length):null},
    rebound2pct:{observed:reb2.length,wins:reb2.filter(x=>x.rebound2pct).length,
      rate:reb2.length>=minSamples?round(100*reb2.filter(x=>x.rebound2pct).length/reb2.length):null},
    note:"Retrospective frequency, not an executable or validated next-day prediction."};
}


/**
 * Walk-forward audit: each dated target is evaluated using strictly earlier
 * histories. Retrospective research only; no trading signal or notification.
 */
export function auditMorningAnalogsChronologically(targets, histories, options={}) {
  if(!Array.isArray(targets)||!Array.isArray(histories)||
     !Number.isInteger(options.minSamples??30)||(options.minSamples??30)<1)
    throw Error("INVALID_FORWARD_INPUT");
  // A report is meaningful only when targets and outcome rows are independently dated.
  const ordered=[...targets].sort((a,b)=>
    String(a?.tradeDate??"").localeCompare(String(b?.tradeDate??"")) ||
    String(a?.code??"").localeCompare(String(b?.code??"")));
  const results=[];
  const seen=new Set();
  // Walk-forward audits default to strict outcome availability; descriptive
  // historical summaries can opt into this via the same option.
  const strictOptions={...options,requireOutcomeAvailability:options.requireOutcomeAvailability!==false};
  for(const target of ordered){
    if(!target||!validDate(target.tradeDate)||
       typeof target.code!=="string"||!/^(?:\d{4}|\d{3}[A-Z])$/.test(target.code))
      throw Error("INVALID_FORWARD_TARGET");
    const key=target.code+"|"+target.tradeDate;
    if(seen.has(key))throw Error("DUPLICATE_FORWARD_TARGET");
    seen.add(key);
    const prediction=summarizeAnalogs(target,histories,strictOptions);
    const observed=histories.filter(row=>row?.code===target.code &&
      row.tradeDate===target.tradeDate && row.outcome?.valid===true &&
      row.outcome.date===target.tradeDate);
    // Multiple conflicting outcome exports cannot be silently selected.
    const outcome=observed.length===1 &&
      priorSnapshot(observed[0].featureAvailableAt,target.tradeDate) &&
      typeof observed[0].outcomeAvailableAt==="string" &&
      /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$/.test(observed[0].outcomeAvailableAt) &&
      Number.isFinite(Date.parse(observed[0].outcomeAvailableAt)) &&
      Date.parse(observed[0].outcomeAvailableAt)>=Date.parse(target.tradeDate+"T11:30:00+09:00") &&
      observed[0].outcome?.valid===true &&
      positive(observed[0].outcome.bottomPrice) &&
      finite(observed[0].outcome.bottomDropPct) &&
      hhmm(observed[0].outcome.bottomWindow) &&
      minute(observed[0].outcome.bottomWindow)>=540 &&
      minute(observed[0].outcome.bottomWindow)<690
      ?observed[0].outcome:null;
    const usable=prediction.eligible&&outcome!==null;
    results.push({code:target.code,tradeDate:target.tradeDate,
      samples:prediction.samples,eligible:prediction.eligible,
      observed:outcome!==null,
      predictedRebound1Pct:prediction.rebound1pct.rate,
      predictedRebound2Pct:prediction.rebound2pct.rate,
      actualRebound1Pct:usable&&typeof outcome.rebound1pct==="boolean"?outcome.rebound1pct:null,
      actualRebound2Pct:usable&&typeof outcome.rebound2pct==="boolean"?outcome.rebound2pct:null});
  }
  const metrics=key=>{
    const rows=results.filter(row=>typeof row[key]==="boolean" &&
      finite(row[key==="actualRebound1Pct"?"predictedRebound1Pct":"predictedRebound2Pct"]));
    const pkey=key==="actualRebound1Pct"?"predictedRebound1Pct":"predictedRebound2Pct";
    return {evaluated:rows.length,
      observedWins:rows.filter(row=>row[key]).length,
      meanPredictedPct:average(rows.map(row=>row[pkey])),
      observedRatePct:rows.length?round(100*rows.filter(row=>row[key]).length/rows.length):null,
      meanAbsoluteErrorPct:rows.length?average(rows.map(row=>Math.abs(row[pkey]-(row[key]?100:0)))):null,
      brierScore:rows.length?average(rows.map(row=>Math.pow(row[pkey]/100-(row[key]?1:0),2))):null};
  };
  const evaluated=results.filter(row=>row.actualRebound1Pct!==null ||
    row.actualRebound2Pct!==null);
  const uniqueStocks=new Set(evaluated.map(row=>row.code)).size;
  const uniqueTradeDates=new Set(evaluated.map(row=>row.tradeDate)).size;
  const uniqueMonths=new Set(evaluated.map(row=>row.tradeDate.slice(0,7))).size;
  const coverage={stocks:uniqueStocks,tradeDates:uniqueTradeDates,months:uniqueMonths};
  // Evaluate baseline and analog forecasts on the SAME dated holdout rows.
  // The expanding baseline may use only strictly earlier trade dates:
  // different stocks on the same date are not independent prior evidence.
  const baseline=key=>{
    const predictionKey=key==="actualRebound1Pct"?"predictedRebound1Pct":"predictedRebound2Pct";
    const scored=results.filter(row=>typeof row[key]==="boolean"&&finite(row[predictionKey]));
    const paired=[];
    for(const row of scored){
      const earlier=scored.filter(prior=>prior.tradeDate<row.tradeDate);
      if(!earlier.length)continue;
      const base=earlier.filter(prior=>prior[key]).length/earlier.length;
      const actual=row[key]?1:0;
      paired.push({baselineError:(base-actual)**2,
        modelError:(row[predictionKey]/100-actual)**2});
    }
    return {evaluated:paired.length,
      brierScore:paired.length?round(paired.reduce((sum,row)=>sum+row.baselineError,0)/paired.length):null,
      modelBrierScore:paired.length?round(paired.reduce((sum,row)=>sum+row.modelError,0)/paired.length):null,
      improvement:paired.length?round(paired.reduce((sum,row)=>sum+row.baselineError-row.modelError,0)/paired.length):null};
  };
  const expandingBaseline={
    rebound1pct:baseline("actualRebound1Pct"),
    rebound2pct:baseline("actualRebound2Pct")};
  const byMonth=[...new Set(results.map(row=>row.tradeDate.slice(0,7)))].sort()
    .map(month=>{
      const rows=results.filter(row=>row.tradeDate.startsWith(month));
      const stats=key=>{
        const predictionKey=key==="actualRebound1Pct"?"predictedRebound1Pct":"predictedRebound2Pct";
        const scored=rows.filter(row=>typeof row[key]==="boolean"&&finite(row[predictionKey]));
        return {evaluated:scored.length,
          observedRatePct:scored.length?round(100*scored.filter(row=>row[key]).length/scored.length):null,
          meanPredictedPct:average(scored.map(row=>row[predictionKey])),
          meanAbsoluteErrorPct:scored.length?average(scored.map(row=>Math.abs(row[predictionKey]-(row[key]?100:0)))):null,
          brierScore:scored.length?average(scored.map(row=>Math.pow(row[predictionKey]/100-(row[key]?1:0),2))):null};
      };
      return {month,targets:rows.length,
        rebound1pct:stats("actualRebound1Pct"),
        rebound2pct:stats("actualRebound2Pct")};
    });
  return {version:"MORNING_ANALOG_FORWARD_AUDIT_V1",targets:results.length,byMonth,
    eligible:results.filter(row=>row.eligible).length,coverage,expandingBaseline,
    rebound1pct:metrics("actualRebound1Pct"),
    rebound2pct:metrics("actualRebound2Pct"),
    rows:results,
    outcomeAvailabilityRequired:strictOptions.requireOutcomeAvailability,
    signalEnabled:false,readyForTrading:false,
    note:"Retrospective walk-forward audit only. Requires independent verified data and prospective validation."};
}
