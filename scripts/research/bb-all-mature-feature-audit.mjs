#!/usr/bin/env node
/** Offline 9-mature-event research table. No future prices in signal features;
 * future returns are outcome LABELS only. No tuning or live trading.
 */
import {readFileSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {inventoryFolderEntries} from "./audit-bb-saved-archives.mjs";
import {auditStitchedStocks,segmentStockSessions} from "./bb-stitch-stock-captures.mjs";
import {reconcileCapturedTradeDay} from "../../app/lib/research/fourPatternJQuantsBridge.mjs";
import {fiveMinuteFromReconciled} from "../../app/lib/research/bbCandleReplay.mjs";
import {detectBbCandleV1} from "../../app/lib/research/bbCandleV1.mjs";
import {featuresAtCompletedSignal} from "./bb-candle-risk-diagnostic.mjs";

const priceKeys=["minute","open","high","low","close","volume","turnover"];
const sameMinutes=(a,b)=>a.length===b.length&&a.every((r,i)=>priceKeys.every(k=>r[k]===b[i][k]));
const eventKey=(code,date,slot)=>code+"|"+date+"|"+slot;
const slotFor=(b)=>{
 const m=Number(b.slot.slice(0,2))*60+Number(b.slot.slice(3))+10;
 return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
};
const closeFor=(b)=>{
 const m=Number(b.slot.slice(0,2))*60+Number(b.slot.slice(3))+5;
 return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
};
export function summarizeMatureFeatures(rows,expected=9){
 if(!Array.isArray(rows)||rows.length!==expected||!Number.isInteger(expected)||expected<1)
   throw Error("INCOMPLETE_MATURE_FEATURE_COHORT");
 const seen=new Set();
 for(const r of rows){
  const k=eventKey(r.code,r.date,r.slot);
  if(seen.has(k)||!r.features||!Array.isArray(r.patterns)||
    !Number.isFinite(r.after5dPct)||!Number.isFinite(r.worstDip5dPct)||
    !["UP","DOWN","SIDEWAYS"].includes(r.priorMarket)||
    !["09:15","11:15","14:10"].includes(r.frozenAsOf)||
    ![r.features.bbWidthPct,r.features.volumeVsPrior20,
      r.features.bodyToRangePct,r.features.last5BarsPct].every(Number.isFinite))
     throw Error("INVALID_MATURE_EVENT_FEATURES");
  seen.add(k);
  if(({ "09:20":"09:15","11:20":"11:15","14:15":"14:10"})[r.slot]!==r.frozenAsOf)
    throw Error("LOOKAHEAD_SIGNAL_CLOCK_MISMATCH");
 }
 const sorted=[...rows].sort((a,b)=>a.date.localeCompare(b.date)||
   a.slot.localeCompare(b.slot)||a.code.localeCompare(b.code));
 const buckets=[{label:"WORST_DIP_BELOW_MINUS_10",match:r=>r.worstDip5dPct<=-10},
  {label:"WORST_DIP_MINUS_10_TO_MINUS_5",match:r=>r.worstDip5dPct>-10&&r.worstDip5dPct<=-5},
  {label:"WORST_DIP_ABOVE_MINUS_5",match:r=>r.worstDip5dPct>-5}].map(b=>({
    label:b.label,observations:sorted.filter(b.match).length,
    distinctDates:new Set(sorted.filter(b.match).map(x=>x.date)).size,
    codes:sorted.filter(b.match).map(x=>x.code)}));
 return {status:"BB_MATURE_SIGNAL_FEATURES_DESCRIPTIVE_ONLY",
  matureEvents:sorted.length,uniqueTradingDates:new Set(sorted.map(x=>x.date)).size,
  outcomeCount:{positive:sorted.filter(x=>x.after5dPct>0).length,
    nonpositive:sorted.filter(x=>x.after5dPct<=0).length},
  predeclaredAdverseBuckets:buckets,events:sorted,
  caution:"Selected and highly overlapping signal sample. Minus-5/minus-10 are descriptive bins, NOT optimized decision thresholds. Correlated same-day events are not independent.",
  noFeatureThresholdTuning:true,liveDataAvailabilityProven:false,
  eligibleForProduction:false,eligibleForNotifications:false};
}
function verifiedSegments(entries,neededCodes){
 const group=new Map([...neededCodes].map(c=>[c,new Map()]));
 for(const {capture} of entries){
  if(!group.has(capture.code))continue;
  if(!Array.isArray(capture.minuteDays)||!Array.isArray(capture.dailyDays)||
      capture.minuteDays.length!==capture.dailyDays.length)throw Error("INVALID_STOCK_ARCHIVE");
  for(let i=0;i<capture.minuteDays.length;i++){
   const m=capture.minuteDays[i],d=capture.dailyDays[i];
   if(m?.date!==d?.date)throw Error("MISMATCHED_STOCK_DAY");
   const v=reconcileCapturedTradeDay({code:capture.code,date:m.date,
     minutePages:m.pages,dailyPages:d.pages});
   const prev=group.get(capture.code).get(m.date);
   if(prev&&!sameMinutes(prev.verified.minutes,v.minutes))
     throw Error("CONFLICTING_STOCK_DAY_PRICES");
   if(!prev)group.get(capture.code).set(m.date,{minute:m,daily:d,verified:v});
  }
 }
 return new Map([...group].map(([code,dates])=>
   [code,segmentStockSessions([...dates.values()])]));
}
export function analyzeAllMatureEvents({benchmark,entries}){
 if(benchmark?.benchmark!=="TOPIX"||!Array.isArray(entries)||!entries.length)
  throw Error("INVALID_ALL_MATURE_REQUEST");
 const baseline=auditStitchedStocks({benchmark,entries});
 const mature=baseline.groupedEvents.flatMap(g=>g.examples.map(e=>({
  code:e.code,date:g.date,slot:g.slot,priorMarket:g.priorMarket,
  after5dPct:e.after5dPct,worstDip5dPct:e.worstDip5dPct})));
 if(mature.length!==baseline.mature5d)throw Error("BASELINE_MATURITY_INCONSISTENCY");
 const needed=new Set(mature.map(e=>e.code));
 const segments=verifiedSegments(entries,needed);
 const byKey=new Map();
 for(const [code,runs] of segments){
  for(const run of runs){
   if(run.length<2)continue;
   const bars=fiveMinuteFromReconciled(run.map(x=>x.verified));
   const detected=detectBbCandleV1(bars);
   const bySignal=new Map();
   for(const hit of detected){
    if(hit.direction!=="BUY")continue;
    const bar=bars[hit.index],slot=slotFor(bar);
    if(!["09:20","11:20","14:15"].includes(slot))continue;
    const k=eventKey(code,bar.date,slot);
    const prev=bySignal.get(k);
    if(prev&&prev.i!==hit.index)throw Error("CONFLICTING_SAME_SLOT_SIGNAL_BAR");
    if(!prev)bySignal.set(k,{i:hit.index,hits:[]});
    bySignal.get(k).hits.push(hit);
   }
   for(const [k,item] of bySignal){
    if(byKey.has(k))throw Error("DUPLICATE_STITCHED_SIGNAL");
    byKey.set(k,{bars,...item});
   }
  }
 }
 const rows=mature.map(e=>{
  const matched=byKey.get(eventKey(e.code,e.date,e.slot));
  if(!matched)throw Error("MATURE_SIGNAL_FEATURE_NOT_FOUND");
  const bar=matched.bars[matched.i];
  const features=featuresAtCompletedSignal(matched.bars,matched.hits[0]);
  return {...e,frozenAsOf:closeFor(bar),
   patterns:[...new Set(matched.hits.map(h=>h.type))].sort(),features};
 });
 return {...summarizeMatureFeatures(rows,baseline.mature5d),
    sourceArchiveFiles:baseline.sourceArchiveFiles,
    baselineObservedBuyEvents:baseline.uniqueClassifiedBuyEvents,
    stillPending5d:baseline.uniqueClassifiedBuyEvents-baseline.mature5d};
}
function loadTopix(path){
 const size=statSync(path).size;
 if(size<2||size>250000)throw Error("INVALID_TOPIX_SIZE");
 return JSON.parse(readFileSync(path,"utf8"));
}
const main=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 try{
  const args=process.argv.slice(2);
  if(args.length<2||args.length>6)throw Error("USAGE_TOPIX_THEN_PRIVATE_FOLDERS");
  console.log(JSON.stringify(analyzeAllMatureEvents({
   benchmark:loadTopix(args[0]),entries:inventoryFolderEntries(args.slice(1))
  }),null,2));
 }catch(e){
  console.error("BB_MATURE_FEATURE_AUDIT_BLOCKED",
   e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?e.message:"INVALID_PRIVATE_INPUT");
  process.exitCode=1;
 }
}
