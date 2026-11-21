#!/usr/bin/env node
/**
 * BB_CANDLE_V1 retrospective same-slot pair diagnostic, read-only.
 * Strictly compares features frozen at the COMPLETED 14:10 signal 5m bar
 * before the modeled 14:15 entry on 2026-11-04 (6326 vs 8410).
 * Only locally retained verified J-Quants data. No network, disk writes,
 * thresholds, alerts, orders or production rule modifications.
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
import {resolveTseTradingDatesAfter} from "../../app/lib/technicalObservation/tseMarketCalendar.ts";

export const PAIR=Object.freeze({date:"2026-11-04",slot:"14:15",codes:["6326","8410"]});
const fields=["minute","open","high","low","close","volume","turnover"];
const eq=(a,b)=>a.length===b.length&&a.every((x,i)=>fields.every(f=>x[f]===b[i][f]));
const round=x=>Number(x.toFixed(4));
const firstSignalSlot=bar=>{
 const m=Number(bar.slot.slice(0,2))*60+Number(bar.slot.slice(3))+10;
 return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
};
export function compareFrozenPair(rows){
 if(!Array.isArray(rows)||rows.length!==2||new Set(rows.map(r=>r.code)).size!==2||
    !PAIR.codes.every(c=>rows.some(r=>r.code===c))||
    rows.some(r=>r.date!==PAIR.date||r.slot!==PAIR.slot||
      !Number.isFinite(r.after5dPct)||!Number.isFinite(r.worstDip5dPct)||
      !r.features||r.asOfSlot!=="14:10"))
   throw Error("INVALID_FROZEN_PAIR");
 const results=[...rows].sort((a,b)=>a.code.localeCompare(b.code));
 const a=results[0],b=results[1];
 const featureKeys=["bbWidthPct","volumeVsPrior20","bodyToRangePct","last5BarsPct"];
 const differences=Object.fromEntries(featureKeys.map(key=>{
   const left=a.features[key],right=b.features[key];
   if(left!==null&&!Number.isFinite(left)||right!==null&&!Number.isFinite(right))
      throw Error("INVALID_PAIR_FEATURE");
   return [key,{code6326:left,code8410:right,
     delta8410Minus6326:left===null||right===null?null:round(right-left)}];
 }));
 return {status:"BB_PAIR_PRE_ENTRY_DESCRIPTIVE_ONLY",date:PAIR.date,entrySlot:PAIR.slot,
  signalBarCompletedAt:"14:10",patternLabels:results.map(x=>({code:x.code,patterns:x.patterns})),
  rows:results,differences,after5dSpread8410Minus6326Pct:round(b.after5dPct-a.after5dPct),
  lookaheadExcludedFromFeatures:true,
  featureAvailability:"FEATURES_FROM_COMPLETED_5M_BAR_ONLY",
  ma75DayPosition:"NOT_CALCULATED_IN_5M_CAPTURE_STUDY",
  sampleSize:2,thresholdTuning:false,eligibleForProduction:false,
  eligibleForNotifications:false,
  caveat:"Selected historical pair; shared market shock; retrospective scenario returns. Cannot discriminate out of sample from two cases."};
}
function eligibleSegments(entries){
 const byCode=new Map(PAIR.codes.map(c=>[c,new Map()]));
 for(const {capture} of entries){
  if(!byCode.has(capture.code))continue;
  const dates=byCode.get(capture.code);
  for(let i=0;i<capture.minuteDays.length;i++){
   const minute=capture.minuteDays[i],daily=capture.dailyDays[i],date=minute?.date;
   if(date!==daily?.date)throw Error("INVALID_DAY_PAIR");
   const verified=reconcileCapturedTradeDay({code:capture.code,date,
     minutePages:minute.pages,dailyPages:daily.pages});
   const before=dates.get(date);
   if(before&&!eq(before.verified.minutes,verified.minutes))
      throw Error("CONFLICTING_PAIRS_OVERLAPPING_MINUTE_ROWS");
   if(!before)dates.set(date,{minute,daily,verified});
  }
 }
 const result=new Map();
 for(const [code,days] of byCode){
  const segments=segmentStockSessions([...days.values()]);
  const matching=segments.filter(s=>s.some(d=>d.minute.date===PAIR.date));
  if(matching.length!==1)throw Error("NO_UNIQUE_SIGNAL_SEGMENT");
  const segment=matching[0];
  const following=resolveTseTradingDatesAfter(PAIR.date,5);
  if(!following.every(d=>segment.some(s=>s.minute.date===d)))
    throw Error("PAIR_FIVE_DAYS_NOT_VERIFIED");
  result.set(code,segment);
 }
 return result;
}
export function analyzeSameSlotPair({benchmark,entries}){
 if(benchmark?.benchmark!=="TOPIX"||!Array.isArray(entries)||!entries.length)
   throw Error("INVALID_PAIR_INPUT");
 // Reuse full 69-file stitched baseline for independent exact outcome checks.
 const baseline=auditStitchedStocks({benchmark,entries});
 const target=baseline.groupedEvents.find(g=>g.date===PAIR.date&&g.slot===PAIR.slot);
 if(!target||target.distinctObservedStocks!==7)throw Error("SEVEN_STOCK_GROUP_NOT_VERIFIED");
 const segments=eligibleSegments(entries),rows=[];
 for(const code of PAIR.codes){
  const outcome=target.examples.find(x=>x.code===code);
  if(!outcome||!Number.isFinite(outcome.after5dPct)||
     !Number.isFinite(outcome.worstDip5dPct))throw Error("PAIR_OUTCOME_NOT_MATURE");
  const seg=segments.get(code);
  const candles=fiveMinuteFromReconciled(seg.map(x=>x.verified));
  const hits=detectBbCandleV1(candles).filter(h=>h.direction==="BUY"&&
     candles[h.index].date===PAIR.date&&firstSignalSlot(candles[h.index])===PAIR.slot);
  if(hits.length===0)throw Error("PAIR_PRE_ENTRY_SIGNAL_NOT_FOUND");
  const indexes=new Set(hits.map(h=>h.index));
  if(indexes.size!==1)throw Error("AMBIGUOUS_PAIR_SIGNAL_BARS");
  const i=hits[0].index,bar=candles[i];
  const signalMinutes=Number(bar.slot.slice(0,2))*60+Number(bar.slot.slice(3))+5;
  const asOfSlot=String(Math.floor(signalMinutes/60)).padStart(2,"0")+":"+
    String(signalMinutes%60).padStart(2,"0");
  if(asOfSlot!=="14:10")throw Error("UNEXPECTED_SIGNAL_CLOSE_TIME");
  const features=featuresAtCompletedSignal(candles,hits[0]);
  const patterns=[...new Set(hits.map(x=>x.type))].sort();
  rows.push({code,date:PAIR.date,slot:PAIR.slot,asOfSlot,patterns,features,
     after5dPct:outcome.after5dPct,worstDip5dPct:outcome.worstDip5dPct});
 }
 return {...compareFrozenPair(rows),sourceArchiveFiles:baseline.sourceArchiveFiles,
  sourceVerifiedStockDates:baseline.totalDistinctStockDates,
  baselineBuyEvents:baseline.uniqueClassifiedBuyEvents,baselineMature5d:baseline.mature5d};
}
function getBenchmark(path){
 const size=statSync(path).size;if(size<2||size>250000)throw Error("INVALID_BENCHMARK_FILE");
 return JSON.parse(readFileSync(path,"utf8"));
}
const main=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 try{
  const args=process.argv.slice(2);
  if(args.length<2||args.length>6)throw Error("USAGE_BENCHMARK_THEN_ARCHIVE_FOLDERS");
  const entries=inventoryFolderEntries(args.slice(1));
  console.log(JSON.stringify(analyzeSameSlotPair({benchmark:getBenchmark(args[0]),entries}),null,2));
 }catch(e){
  console.error("BB_PAIR_DIAGNOSTIC_BLOCKED",
   e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?e.message:"INVALID_PRIVATE_INPUT");
  process.exitCode=1;
 }
}
