import { analyzeNecklineTimeline } from "./necklineEarlyStudy.mjs";
import { frozenNecklineFeatures } from "./necklineFrozenFeatures.mjs";

export const NECKLINE_FORWARD_VERSION = "NECKLINE_PREOPEN_FORWARD_V1";
export const NECKLINE_FORWARD_CODES = Object.freeze([
  "7164","3774","5929","7752","4331",
  "9024","1835","4612","3661","7038",
  "9682","3762","3753","3996","3540",
]);
export const NECKLINE_FORWARD_BATCH_COUNT = 3;
export const NECKLINE_FORWARD_BATCH_SIZE = 5;
export const NECKLINE_FORWARD_EARLIEST_DATE = "2026-11-09";

const dateOf = time => new Date(time*1000).toLocaleDateString("sv-SE",{timeZone:"Asia/Tokyo"});
const num = x => typeof x === "number" && Number.isFinite(x) && x>0;
const rounded = x => Math.round(x*10000)/10000;

export function selectFrozenNecklineCandidate(stock, expectedDay, observedPreopenDay) {
  if(!stock || stock.error || !stock.barsSha256
    || !/^[0-9a-f]{64}$/.test(stock.barsSha256)
    || !Array.isArray(stock.candles) || stock.candles.length<25
    || stock.latestDate!==expectedDay
    || expectedDay>=observedPreopenDay
    || expectedDay<NECKLINE_FORWARD_EARLIEST_DATE) return null;
  const candles=stock.candles;
  const latest=candles[candles.length-1];
  if(dateOf(latest.time)!==expectedDay) return null;
  const study=analyzeNecklineTimeline(candles);
  if(!study.dataValid) return null;
  // A candidate may be recorded only on the FIRST day it was detectable.
  // Never backfill a prior signal after a later fetch succeeds.
  const candidate=study.events.find(e=>e.firstSeenIndex===candles.length-1 && e.status==="WATCH");
  if(!candidate) return null;
  const features=frozenNecklineFeatures(candidate,candles);
  if(!features || features.observedAtTime!==latest.time) return null;
  return {
    policyVersion:NECKLINE_FORWARD_VERSION,
    code:stock.code,signalDate:expectedDay,observedPreopenDate:observedPreopenDay,
    firstSeenTime:latest.time,firstBottomTime:candles[candidate.first].time,
    secondBottomTime:candles[candidate.second].time,
    signalClose:latest.close,low1:candidate.low1,low2:candidate.low2,
    neckline:candidate.neckline,asofFeatures:features,
    inputBars:candles,sourceSha256:stock.barsSha256,
  };
}

/**
 * Calendar dates (trading sessions) are supplied by the independently
 * published JPX calendar. No substitution of the next available Yahoo row:
 * any missing daily session leaves the outcome pending.
 * Index i in requiredDates is 1-based relative to the frozen signal day.
 */
export function evaluateFrozenNecklineOutcome(signalDate,candles,requiredDates,horizon,cost=0.2) {
  if(![3,5].includes(horizon) || !Array.isArray(candles)
    || !Array.isArray(requiredDates) || requiredDates.length<horizon
    || requiredDates.some(d=>typeof d!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d))
    || !num(candles?.[0]?.open) || !Number.isFinite(cost) || cost<0) return null;
  const dates=requiredDates.slice(0,horizon);
  if(dates.some((d,i)=>d<=signalDate || i>0&&d<=dates[i-1])) return null;
  const byDay=new Map();
  let prior=-Infinity;
  for(const bar of candles){
    if(!bar || !num(bar.time)||!num(bar.open)||!num(bar.high)||!num(bar.low)||!num(bar.close)
      ||bar.high<Math.max(bar.open,bar.close,bar.low)
      ||bar.low>Math.min(bar.open,bar.close,bar.high)
      ||bar.time<=prior) return null;
    prior=bar.time;
    const day=dateOf(bar.time);
    if(byDay.has(day)) return null;
    byDay.set(day,bar);
  }
  const relevant=dates.map(d=>byDay.get(d));
  if(relevant.some(c=>!c)) return null;
  const entry=relevant[0].open,exit=relevant[horizon-1].close;
  const low=Math.min(...relevant.map(c=>c.low));
  return {
    horizon,entryDate:dates[0],exitDate:dates[horizon-1],
    entryOpen:entry,exitClose:exit,
    returnPercent:rounded((exit/entry-1)*100-cost),
    maxAdversePercent:rounded((low/entry-1)*100),
  };
}

export function necklineForwardQualitySummary(rows,expectedDay) {
  if(!Array.isArray(rows))throw Error("invalid research rows");
  const status=rows.map(stock=>({
    code:stock.code,
    state:stock.error?"FAILED":stock.latestDate===expectedDay?"VALID":"STALE",
    lastDate:stock.latestDate??null,
    attempts:stock.attempts??1,
    error:stock.error??(stock.latestDate===expectedDay?null:"最新の確定日足が対象日に一致しません"),
    source:stock.source??"UNKNOWN",
    sha256:stock.barsSha256??null,
    bars:stock.candles?.length??0,
  }));
  const valid=status.filter(s=>s.state==="VALID").length;
  return {expectedDay,requested:status.length,valid,missing:status.length-valid,results:status,
    coverageComplete:valid===status.length};
}
