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
  if(!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)||!positive(previousClose)||
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
  if(!target||!/^\d{4}-\d{2}-\d{2}$/.test(target.tradeDate)||
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
  const pool=histories.filter(row=>row && row.tradeDate<target.tradeDate &&
    priorSnapshot(row.featureAvailableAt,row.tradeDate) &&
    usableFeatures(row) && row.outcome?.valid===true &&
    row.outcome.date===row.tradeDate &&
    positive(row.outcome.bottomPrice) && finite(row.outcome.bottomDropPct) &&
    hhmm(row.outcome.bottomWindow));
  // One stock/date is one independent historical observation. Duplicate exports
  // must not inflate sample size or rebound frequency.
  const seen=new Set();
  const unique=pool.filter(row=>{
    if(typeof row.code!=="string"||!/^(?:\d{4}|\d{3}[A-Z])$/.test(row.code))return false;
    const key=row.code+"|"+row.tradeDate;
    if(seen.has(key))return false;
    seen.add(key);return true;
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
    if(!row||row.valid!==true||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||
       !hhmm(row.bottomWindow)||!positive(row.bottomPrice)||
       !finite(row.bottomDropPct)||!finite(row.earlyDropPct)||
       !Number.isInteger(row.intervalMinutes)||row.intervalMinutes>binMinutes||
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
