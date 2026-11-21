#!/usr/bin/env node
/**
 * BB_CANDLE_V1: all observed BUY signals, not just mature winners.
 * Offline, read-only, strict local J-Quants reconciliation. Detect multi-pattern
 * signatures from completed pre-entry bars; future outcomes are labels only.
 */
import {readFileSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {inventoryFolderEntries} from "./audit-bb-saved-archives.mjs";
import {auditStitchedStocks,segmentStockSessions} from "./bb-stitch-stock-captures.mjs";
import {reconcileCapturedTradeDay} from "../../app/lib/research/fourPatternJQuantsBridge.mjs";
import {fiveMinuteFromReconciled} from "../../app/lib/research/bbCandleReplay.mjs";
import {detectBbCandleV1} from "../../app/lib/research/bbCandleV1.mjs";
const fields=["minute","open","high","low","close","volume","turnover"];
const equal=(a,b)=>a.length===b.length&&a.every((x,i)=>fields.every(f=>x[f]===b[i][f]));
const key=(code,date,slot)=>[code,date,slot].join("|");
const clock=(b,plus)=>{
 const minutes=Number(b.slot.slice(0,2))*60+Number(b.slot.slice(3))+plus;
 return String(Math.floor(minutes/60)).padStart(2,"0")+":"+String(minutes%60).padStart(2,"0");
};
const BOTH=["ENGULFING","MARUBOZU"];
export function auditAllPatternOccurrences(rows,{expected=22}={}){
 if(!Array.isArray(rows)||!rows.length||rows.length!==expected)throw Error("INCOMPLETE_ALL_SIGNAL_AUDIT");
 const keys=new Set();
 for(const e of rows){
  const k=key(e.code,e.date,e.slot);
  if(keys.has(k)||!Array.isArray(e.patterns)||!e.patterns.length||
     !["09:20","11:20","14:15"].includes(e.slot)||
     !({"09:20":"09:15","11:20":"11:15","14:15":"14:10"}[e.slot]===e.frozenAsOf)||
     typeof e.priorMarket!=="string"||
     (e.after5dPct!==null&&!Number.isFinite(e.after5dPct))||
     (e.worstDip5dPct!==null&&!Number.isFinite(e.worstDip5dPct))||
     (e.after5dPct===null)!==(e.worstDip5dPct===null))
    throw Error("INVALID_ALL_SIGNAL_EVENT");
  keys.add(k);
 }
 const sorted=[...rows].sort((a,b)=>a.date.localeCompare(b.date)||
   a.slot.localeCompare(b.slot)||a.code.localeCompare(b.code));
 const describe=(items)=>({
  observedEvents:items.length,
  distinctDates:new Set(items.map(x=>x.date)).size,
  dates:[...new Set(items.map(x=>x.date))].sort(),
  mature5d:items.filter(e=>e.after5dPct!==null).length,
  pending5d:items.filter(e=>e.after5dPct===null).length,
  positiveMature:items.filter(e=>e.after5dPct!==null&&e.after5dPct>0).length,
  nonPositiveMature:items.filter(e=>e.after5dPct!==null&&e.after5dPct<=0).length
 });
 const selected=sorted.filter(e=>BOTH.every(p=>e.patterns.includes(p)));
 const other=sorted.filter(e=>!BOTH.every(p=>e.patterns.includes(p)));
 const outside=selected.filter(e=>e.date!=="2026-11-04");
 return {status:"BB_ALL_OBSERVED_PATTERN_OCCURRENCES_ONLY",
  total:describe(sorted),combined:describe(selected),other:describe(other),
  outsideNov4:describe(outside),combinedEvents:selected,
  outsideNov4Events:outside,
  allEventKeys:sorted.map(e=>({date:e.date,slot:e.slot,code:e.code,
     patterns:e.patterns,mature5d:e.after5dPct!==null})),
  signalFeaturesUseFuture:false,outcomesNotUsedToSelectPatterns:true,
  sampleIsSelectedAndIncomplete:true,
  eligibleForProduction:false,eligibleForNotifications:false,
  caveat:"This is a selected historical local archive set. Absence of another dated example in this set is not proof absence in the market; labels are retrospective and correlated."};
}
function deriveSignalPatterns(entries,neededCodes){
 const byCode=new Map([...neededCodes].map(c=>[c,new Map()]));
 for(const {capture} of entries){
  if(!byCode.has(capture.code))continue;
  const days=byCode.get(capture.code);
  if(!Array.isArray(capture.minuteDays)||!Array.isArray(capture.dailyDays)||
    capture.minuteDays.length!==capture.dailyDays.length)throw Error("BAD_CAPTURE");
  for(let i=0;i<capture.minuteDays.length;i++){
   const m=capture.minuteDays[i],d=capture.dailyDays[i];
   if(m?.date!==d?.date)throw Error("BAD_CAPTURE_DAY_PAIR");
   const verified=reconcileCapturedTradeDay({code:capture.code,date:m.date,
     minutePages:m.pages,dailyPages:d.pages});
   const old=days.get(m.date);
   if(old&&!equal(old.verified.minutes,verified.minutes))
     throw Error("CONFLICTING_OVERLAPPING_MINUTES");
   if(!old)days.set(m.date,{minute:m,daily:d,verified});
  }
 }
 const found=new Map();
 for(const [code,days] of byCode){
  for(const segment of segmentStockSessions([...days.values()])){
   if(segment.length<2)continue;
   const bars=fiveMinuteFromReconciled(segment.map(x=>x.verified));
   for(const hit of detectBbCandleV1(bars)){
    if(hit.direction!=="BUY")continue;
    const bar=bars[hit.index],slot=clock(bar,10);
    if(!["09:20","11:20","14:15"].includes(slot))continue;
    const k=key(code,bar.date,slot);
    const match=found.get(k);
    if(match&&match.index!==hit.index)throw Error("CONFLICTING_SIGNAL_INDEX");
    if(match&&match.segmentFirst!==segment[0].minute.date)throw Error("DUPLICATE_SIGNAL_SEGMENT");
    if(!match)found.set(k,{index:hit.index,segmentFirst:segment[0].minute.date,
      frozenAsOf:clock(bar,5),patterns:new Set()});
    found.get(k).patterns.add(hit.type);
   }
  }
 }
 return found;
}
export function analyzeAllObservedPatterns({benchmark,entries}){
 if(benchmark?.benchmark!=="TOPIX"||!Array.isArray(entries)||!entries.length)
  throw Error("INVALID_PATTERN_AUDIT_INPUT");
 const baseline=auditStitchedStocks({benchmark,entries});
 const wanted=baseline.groupedEvents.flatMap(group=>
  group.codes.map(code=>({code,date:group.date,slot:group.slot,
   priorMarket:group.priorMarket,
   outcome:group.examples.find(x=>x.code===code)??null})));
 if(wanted.length!==baseline.uniqueClassifiedBuyEvents)
  throw Error("BASELINE_SIGNAL_COUNT_MISMATCH");
 const observed=deriveSignalPatterns(entries,new Set(wanted.map(x=>x.code)));
 const rows=wanted.map(e=>{
  const match=observed.get(key(e.code,e.date,e.slot));
  if(!match)throw Error("BASELINE_SIGNAL_PATTERN_NOT_FOUND");
  return {code:e.code,date:e.date,slot:e.slot,priorMarket:e.priorMarket,
   frozenAsOf:match.frozenAsOf,patterns:[...match.patterns].sort(),
   after5dPct:e.outcome?.after5dPct??null,
   worstDip5dPct:e.outcome?.worstDip5dPct??null};
 });
 return {...auditAllPatternOccurrences(rows,{expected:baseline.uniqueClassifiedBuyEvents}),
   sourceArchiveFiles:baseline.sourceArchiveFiles};
}
function getBenchmark(p){const size=statSync(p).size;
 if(size<2||size>250000)throw Error("INVALID_BENCHMARK");
 return JSON.parse(readFileSync(p,"utf8"));}
const main=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 try{
  const args=process.argv.slice(2);
  if(args.length<2||args.length>6)throw Error("USAGE_TOPIX_AND_PRIVATE_FOLDERS");
  console.log(JSON.stringify(analyzeAllObservedPatterns({
   benchmark:getBenchmark(args[0]),entries:inventoryFolderEntries(args.slice(1))
  }),null,2));
 }catch(e){
  console.error("BB_ALL_PATTERN_OCCURRENCES_BLOCKED",
   e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?e.message:"INVALID_PRIVATE_INPUT");
  process.exitCode=1;
 }
}
