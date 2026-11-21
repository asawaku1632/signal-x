#!/usr/bin/env node
/**
 * Offline-only BB_CANDLE_V1 per-security date stitching.
 * Reconcile all captured 1-min/daily pages, reject conflicts in overlapping
 * stock-dates, then replay each security on MAXIMAL CONTIGUOUS JPX sessions.
 * Nothing is uploaded, saved, bought, sold, notified or modified.
 * Retrospective sample is selected and incomplete; no trading inference.
 */
import {readFileSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {inventoryFolderEntries} from "./audit-bb-saved-archives.mjs";
import {reconcileCapturedTradeDay} from "../../app/lib/research/fourPatternJQuantsBridge.mjs";
import {replayBbCandleArchives} from "../../app/lib/research/bbCandleReplay.mjs";
import {resolveTseTradingDatesAfter} from "../../app/lib/technicalObservation/tseMarketCalendar.ts";
import {validateBenchmarkCloses,priorMarketRegime} from "../../app/lib/research/bbMarketRegimeV1.mjs";

const compareFields=["minute","open","high","low","close","volume","turnover"];
const source=({minute,daily,verified})=>({minute,daily,verified});
const equalDay=(a,b)=>a.length===b.length&&a.every((m,i)=>compareFields.every(k=>m[k]===b[i][k]));
const daysEqual=(a,b)=>equalDay(a.verified.minutes,b.verified.minutes)&&
 a.verified.dailyMatched===true&&b.verified.dailyMatched===true;
export function segmentStockSessions(entries){
 if(!Array.isArray(entries)||entries.length===0)throw Error("NO_STOCK_DAYS");
 const ordered=[...entries].sort((a,b)=>a.minute.date.localeCompare(b.minute.date));
 const segments=[];let current=[];
 for(const item of ordered){
   if(item?.minute?.date!==item?.daily?.date)throw Error("UNPAIRED_STOCK_DATE");
   if(current.length){
     const last=current.at(-1).minute.date;
     if(item.minute.date===last)throw Error("DUPLICATE_UNMERGED_DATE");
     if(resolveTseTradingDatesAfter(last,1)[0]!==item.minute.date){
       segments.push(current);current=[];
     }
   }
   current.push(item);
   if(current.length>35)throw Error("EXCEEDS_MAX_VERIFIED_SESSIONS");
 }
 if(current.length)segments.push(current);
 return segments;
}
export function deduplicateSignalObservations(observations){
 const found=new Map();
 for(const e of observations){
  const k=e.code+"|"+e.date+"|"+e.slot;
  if(found.has(k))throw Error("DUPLICATE_BUY_EVENT_ACROSS_STOCK_SEGMENTS");
  found.set(k,e);
 }
 return [...found.values()].sort((a,b)=>a.date.localeCompare(b.date)||
   a.slot.localeCompare(b.slot)||a.code.localeCompare(b.code));
}
function inspectAll(entries,closes){
 const byCode=new Map();let duplicateStockDateCaptures=0;
 for(const {capture} of entries){
  const code=capture?.code;
  if(typeof code!=="string"||!/^[0-9]{3}[0-9A-Z]$/.test(code)||
     !Array.isArray(capture.minuteDays)||!Array.isArray(capture.dailyDays)||
     capture.minuteDays.length!==capture.dailyDays.length)
    throw Error("INVALID_ARCHIVE_INPUT");
  if(!byCode.has(code))byCode.set(code,new Map());
  const dates=byCode.get(code);
  for(let i=0;i<capture.minuteDays.length;i++){
    const minute=capture.minuteDays[i],daily=capture.dailyDays[i];
    const date=minute?.date;
    if(date!==daily?.date)throw Error("MISMATCHED_MINUTE_DAILY_DATE");
    const verified=reconcileCapturedTradeDay({code,date,minutePages:minute.pages,dailyPages:daily.pages});
    const prev=dates.get(date);
    const obj=source({minute,daily,verified});
    if(prev){
      if(!daysEqual(prev,obj))throw Error("CONFLICTING_OVERLAPPING_OHLCV");
      duplicateStockDateCaptures++;
    }else dates.set(date,obj);
  }
 }
 const buy=[],coverage=[],blocked=[];
 let skippedShortSegments=0,totalVerifiedSessions=0;
 for(const [code,dates] of byCode){
  const segments=segmentStockSessions([...dates.values()]);
  totalVerifiedSessions+=dates.size;
  for(const segment of segments){
    const first=segment[0].minute.date,last=segment.at(-1).minute.date;
    coverage.push({code,first,last,tradingDates:segment.length});
    if(segment.length<2){skippedShortSegments++;continue;}
    const archive={code,minuteDays:segment.map(x=>x.minute),dailyDays:segment.map(x=>x.daily)};
    let replay;
    try{replay=replayBbCandleArchives([archive],{exploratoryDetails:true});}
    catch(e){blocked.push({code,first,last,reason:"REPLAY_REJECTED"});continue;}
    for(const event of replay.exploratoryBuyEvents){
      const market=priorMarketRegime(event.date,closes);
      if(market.regime==="UNKNOWN")continue;
      buy.push({...event,marketRegime:market.regime});
    }
  }
 }
 if(blocked.length)throw Error("STOCK_REPLAY_BLOCKED");
 return {events:deduplicateSignalObservations(buy),coverage,
   totalVerifiedSessions,duplicateStockDateCaptures,skippedShortSegments,
   totalUniqueStocks:byCode.size};
}
export function auditStitchedStocks({benchmark,entries}){
 if(benchmark?.benchmark!=="TOPIX"||!Array.isArray(entries)||entries.length<1||entries.length>300)
   throw Error("INVALID_STITCH_REQUEST");
 const closes=validateBenchmarkCloses(benchmark.closes);
 const sample=inspectAll(entries,closes),bySlot=new Map();
 for(const event of sample.events){
   const k=event.date+"|"+event.slot;
   if(!bySlot.has(k))bySlot.set(k,[]);
   bySlot.get(k).push(event);
 }
 const grouped=[...bySlot].map(([key,events])=>{
   const [date,slot]=key.split("|");
   const allMarkets=[...new Set(events.map(e=>e.marketRegime))];
   if(allMarkets.length!==1)throw Error("CONFLICTING_MARKET_CONTEXT");
   const mature=events.filter(e=>e.after5dPct!==null);
   return {date,slot,distinctObservedStocks:events.length,
     codes:events.map(e=>e.code).sort(),priorMarket:allMarkets[0],
     mature5d:mature.length,notMature5d:events.length-mature.length,
     examples:mature.map(e=>({code:e.code,after5dPct:e.after5dPct,
       worstDip5dPct:e.worstDip5dPct})).sort((a,b)=>a.code.localeCompare(b.code))};
 }).sort((a,b)=>a.date.localeCompare(b.date)||a.slot.localeCompare(b.slot));
 return {status:"BB_STITCHED_LOCAL_OBSERVATIONS_ONLY",
   sourceArchiveFiles:entries.length,totalUniqueStocks:sample.totalUniqueStocks,
   totalDistinctStockDates:sample.totalVerifiedSessions,
   duplicateStockDateCaptures:sample.duplicateStockDateCaptures,
   skippedSingleDaySegments:sample.skippedShortSegments,
   stitchedSegments:sample.coverage.length,
   uniqueClassifiedBuyEvents:sample.events.length,
   mature5d:sample.events.filter(x=>x.after5dPct!==null).length,
   observedMultipleSlotGroups:grouped.filter(x=>x.distinctObservedStocks>1).length,
   groupedEvents:grouped,
   sampleCaveat:"Local files are selected and incomplete by stock, time and date. Multi-signal co-occurrence is an observed subset only; singleton does not establish a market-wide solo signal. Historical backtest, not forward proof.",
   eligibleForProduction:false,eligibleForNotifications:false};
}
function getBenchmark(path){
 const s=statSync(path).size;if(s<2||s>250000)throw Error("INVALID_TOPIX_FILE_SIZE");
 return JSON.parse(readFileSync(path,"utf8"));
}
const isMain=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 try{
  const args=process.argv.slice(2);
  if(args.length<2||args.length>6)throw Error("USAGE_TOPIX_THEN_ARCHIVE_DIRECTORIES");
  const result=auditStitchedStocks({benchmark:getBenchmark(args[0]),
    entries:inventoryFolderEntries(args.slice(1))});
  console.log(JSON.stringify(result,null,2));
 }catch(e){
  console.error("BB_STITCHED_AUDIT_BLOCKED",
    e instanceof Error&&/^[A-Z_0-9]+$/.test(e.message)?e.message:"INVALID_LOCAL_INPUT");
  process.exitCode=1;
 }
}
